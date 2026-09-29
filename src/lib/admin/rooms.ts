import { createHash } from "crypto";
import { getRawRedis, getRedis } from "@/lib/redis";
import {
  ROOMS_INDEX_KEY,
  ROOM_REVISIONS_KEY,
  joinedRoomsKey,
  participantsKey,
  roomKey,
  type Room,
} from "@/lib/rooms";
import {
  MAX_STORED_CHAT_MESSAGES,
  chatColorKey,
  chatCountKey,
  chatKey,
  type ChatMessage,
} from "@/lib/roomChat";
import { moodKey } from "@/lib/roomMood";
import { checkinCountKey, presenceKey } from "@/lib/roomPresence";
import { countryKey } from "@/lib/roomCountry";
import { roomAlertedKey, roomSubscribersKey, roomViewingKey } from "@/lib/roomPush";
import { getRoomEndTime } from "@/lib/roomTime";
import { AdminError } from "./errors";
import { personKind, resolvePeople } from "./people";
import { getSuspendedIdentities } from "@/lib/suspension";
import type { AdminMessage, AdminRoom, AdminRoomDetail } from "./types";

// Rooms the admin has deleted sit here instead of being destroyed: the
// record moves out of the live keys (so every page treats it as gone), while
// its participants, chat and the rest stay exactly where they were — so a
// restore puts everything back as it was.
const TRASH_INDEX_KEY = "waiting-room:admin:trash"; // sorted set: id by time trashed
const trashKey = (id: string) => `waiting-room:admin:trash:room:${id}`;

/** A room record as stored — the participant count is never trusted from
 * storage (it's recounted on every read). */
export type StoredRoom = Omit<Room, "participantCount"> & { participantCount?: number };
type TrashRecord = { room: StoredRoom; trashedAt: string; trashedBy: string };

/** Posts from the dashboard appear in a room's chat under this identity. */
export const SYSTEM_IDENTITY = "system:waiting-room";
export const SYSTEM_DISPLAY_NAME = "The Waiting Room";
const SYSTEM_COLOR = "#ffffff";
export const MAX_CHAT_TEXT_LENGTH = 300;

function requireRedis() {
  const redis = getRedis();
  if (!redis) throw new AdminError("Storage isn't configured.", 503);
  return redis;
}

function requireRawRedis() {
  const redis = getRawRedis();
  if (!redis) throw new AdminError("Storage isn't configured.", 503);
  return redis;
}

function isoOrNull(ms: number): string | null {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function imageVersionOf(imageUrl: string | null | undefined): string {
  if (!imageUrl) return "none";
  return createHash("sha1").update(imageUrl).digest("hex").slice(0, 12);
}

function toAdminRoom(
  room: StoredRoom,
  extras: { participantCount: number; messageCount: number; trashedAt: string | null; imageVersion: string },
): AdminRoom {
  const time = room.time ?? null;
  return {
    id: room.id,
    name: room.name,
    date: room.date,
    time,
    endsAt: isoOrNull(getRoomEndTime({ date: room.date, time }).getTime()) ?? room.date,
    category: room.category,
    createdBy: room.createdBy,
    createdByLabel: room.createdByLabel,
    createdByCountry: room.createdByCountry ?? null,
    createdAt: room.createdAt,
    description: room.description ?? null,
    ctaText: room.ctaText ?? null,
    ctaLink: room.ctaLink ?? null,
    isPrivate: room.isPrivate === true,
    participantCount: extras.participantCount,
    messageCount: extras.messageCount,
    trashedAt: extras.trashedAt,
    imageVersion: extras.imageVersion,
  };
}

// Room records carry their full image, often a megabyte or more. The
// dashboard refreshes its room list every few seconds, so records are kept
// here between refreshes and only re-read when their revision number moves
// (see ROOM_REVISIONS_KEY) — otherwise every refresh would pull every image.
type CachedRoom = { revision: number; room: StoredRoom; imageVersion: string; trashedAt: string | null };
const liveCache = new Map<string, CachedRoom>();
const trashCache = new Map<string, CachedRoom>();

/** Every room — public, private, ended and in the trash — newest first,
 * without images (those load through /api/admin/image). */
export async function listAdminRooms(): Promise<AdminRoom[]> {
  const redis = getRedis();
  if (!redis) return [];

  const [liveIds, trashIds, revisionsRaw] = await redis
    .pipeline()
    .lrange(ROOMS_INDEX_KEY, 0, -1)
    .zrange(TRASH_INDEX_KEY, 0, -1, { rev: true })
    .hgetall(ROOM_REVISIONS_KEY)
    .exec<[string[], string[], Record<string, unknown> | null]>();

  const revisions = revisionsRaw ?? {};
  const revisionOf = (id: string) => Number(revisions[id]) || 0;
  const staleLive = liveIds.filter((id) => liveCache.get(id)?.revision !== revisionOf(id));
  const staleTrash = trashIds.filter((id) => trashCache.get(id)?.revision !== revisionOf(id));
  const allIds = [...liveIds, ...trashIds];
  if (allIds.length === 0) return [];

  const pipeline = redis.pipeline();
  staleLive.forEach((id) => pipeline.get(roomKey(id)));
  staleTrash.forEach((id) => pipeline.get(trashKey(id)));
  allIds.forEach((id) => pipeline.hlen(participantsKey(id)));
  allIds.forEach((id) => pipeline.llen(chatKey(id)));
  const results = await pipeline.exec<unknown[]>();

  let cursor = 0;
  for (const id of staleLive) {
    const room = results[cursor++] as StoredRoom | null;
    if (room) {
      liveCache.set(id, {
        revision: revisionOf(id),
        room,
        imageVersion: imageVersionOf(room.imageUrl),
        trashedAt: null,
      });
    } else {
      liveCache.delete(id);
    }
  }
  for (const id of staleTrash) {
    const record = results[cursor++] as TrashRecord | null;
    if (record?.room) {
      trashCache.set(id, {
        revision: revisionOf(id),
        room: record.room,
        imageVersion: imageVersionOf(record.room.imageUrl),
        trashedAt: record.trashedAt,
      });
    } else {
      trashCache.delete(id);
    }
  }
  const participantCounts = results.slice(cursor, cursor + allIds.length).map((n) => Number(n) || 0);
  const messageCounts = results
    .slice(cursor + allIds.length, cursor + allIds.length * 2)
    .map((n) => Number(n) || 0);

  const liveSet = new Set(liveIds);
  const rooms: AdminRoom[] = [];
  allIds.forEach((id, i) => {
    const cached = liveSet.has(id) ? liveCache.get(id) : trashCache.get(id);
    if (!cached) return;
    rooms.push(
      toAdminRoom(cached.room, {
        participantCount: participantCounts[i],
        messageCount: messageCounts[i],
        trashedAt: cached.trashedAt,
        imageVersion: cached.imageVersion,
      }),
    );
  });
  return rooms;
}

export type LocatedRoom = { where: "live" | "trash"; room: StoredRoom; trashedAt: string | null };

/** A room wherever it currently is — live or in the trash. */
export async function locateRoom(id: string): Promise<LocatedRoom | null> {
  const redis = requireRedis();
  const live = await redis.get<StoredRoom>(roomKey(id));
  if (live) return { where: "live", room: live, trashedAt: null };
  const trashed = await redis.get<TrashRecord>(trashKey(id));
  if (trashed?.room) return { where: "trash", room: trashed.room, trashedAt: trashed.trashedAt };
  return null;
}

export async function requireRoom(id: string): Promise<LocatedRoom> {
  const located = await locateRoom(id);
  if (!located) throw new AdminError("That room no longer exists.", 404);
  return located;
}

/** Saves an edited record wherever the room currently is. */
export async function writeRoomRecord(id: string, next: StoredRoom): Promise<void> {
  const redis = requireRedis();
  if (await redis.exists(roomKey(id))) {
    await redis.pipeline().set(roomKey(id), next).hincrby(ROOM_REVISIONS_KEY, id, 1).exec();
    return;
  }
  const trashed = await redis.get<TrashRecord>(trashKey(id));
  if (trashed) {
    await redis
      .pipeline()
      .set(trashKey(id), { ...trashed, room: next })
      .hincrby(ROOM_REVISIONS_KEY, id, 1)
      .exec();
    return;
  }
  throw new AdminError("That room was deleted permanently, so it can't be changed.", 410);
}

export async function trashRoom(id: string, actor: string): Promise<StoredRoom> {
  const redis = requireRedis();
  const room = await redis.get<StoredRoom>(roomKey(id));
  if (!room) {
    if (await redis.exists(trashKey(id))) throw new AdminError("That room is already in the trash.", 409);
    throw new AdminError("That room no longer exists.", 404);
  }
  const record: TrashRecord = { room, trashedAt: new Date().toISOString(), trashedBy: actor };
  // Copy into the trash first, then take the live one down — an interruption
  // in between leaves a duplicate, never a lost room.
  await redis
    .pipeline()
    .set(trashKey(id), record)
    .zadd(TRASH_INDEX_KEY, { score: Date.now(), member: id })
    .exec();
  await redis
    .pipeline()
    .del(roomKey(id))
    .lrem(ROOMS_INDEX_KEY, 0, id)
    .hincrby(ROOM_REVISIONS_KEY, id, 1)
    .exec();
  liveCache.delete(id);
  return room;
}

export async function restoreRoom(id: string): Promise<StoredRoom> {
  const redis = requireRedis();
  const record = await redis.get<TrashRecord>(trashKey(id));
  if (!record?.room) {
    if (await redis.exists(roomKey(id))) throw new AdminError("That room is already live.", 409);
    throw new AdminError("That room was deleted permanently, so it can't be brought back.", 410);
  }
  await redis.set(roomKey(id), record.room);
  await insertIntoIndex(id, record.room.createdAt);
  await redis
    .pipeline()
    .del(trashKey(id))
    .zrem(TRASH_INDEX_KEY, id)
    .hincrby(ROOM_REVISIONS_KEY, id, 1)
    .exec();
  trashCache.delete(id);
  return record.room;
}

/** The index lists rooms newest first (they're pushed on as they're
 * created), and "Recently Created" relies on that — so a restored room goes
 * back into its original slot by creation time, not to the top. */
async function insertIntoIndex(id: string, createdAt: string): Promise<void> {
  const redis = requireRedis();
  await listAdminRooms(); // brings the cache (and so everyone's createdAt) up to date
  const ids = await redis.lrange<string>(ROOMS_INDEX_KEY, 0, -1);
  if (ids.includes(id)) return;

  const pivot = ids.find((otherId) => {
    const other = liveCache.get(otherId)?.room;
    return other ? other.createdAt < createdAt : false;
  });
  if (pivot) {
    const inserted = await redis.linsert(ROOMS_INDEX_KEY, "before", pivot, id);
    if (inserted !== -1) return;
  }
  await redis.rpush(ROOMS_INDEX_KEY, id);
}

/** Deletes a trashed room for good, with everything that belonged to it —
 * participants, chat, moods, check-ins, countries and alerts. */
export async function purgeRoom(id: string): Promise<StoredRoom> {
  const redis = requireRedis();
  if (await redis.exists(roomKey(id))) {
    throw new AdminError("Move the room to the trash before deleting it permanently.", 409);
  }
  const [trashed, participants] = await redis
    .pipeline()
    .get(trashKey(id))
    .hgetall(participantsKey(id))
    .exec<[TrashRecord | null, Record<string, string> | null]>();
  if (!trashed?.room) throw new AdminError("That room was already deleted permanently.", 410);

  const pipeline = redis.pipeline();
  // Take it off the "rooms I've joined" list of everyone who was in it.
  Object.keys(participants ?? {}).forEach((identity) => pipeline.srem(joinedRoomsKey(identity), id));
  pipeline.del(
    trashKey(id),
    participantsKey(id),
    chatKey(id),
    chatColorKey(id),
    chatCountKey(id),
    moodKey(id),
    presenceKey(id),
    checkinCountKey(id),
    countryKey(id),
    roomSubscribersKey(id),
    roomAlertedKey(id),
    roomViewingKey(id),
  );
  pipeline.zrem(TRASH_INDEX_KEY, id);
  pipeline.hdel(ROOM_REVISIONS_KEY, id);
  await pipeline.exec();
  trashCache.delete(id);
  return trashed.room;
}

/** The room's full record including its image, from wherever it is. */
export async function getRoomImage(id: string): Promise<string | null> {
  const located = await locateRoom(id);
  return located?.room.imageUrl ?? null;
}

// ---------------------------------------------------------------------------
// Participants

/** Everything tied to one person's place in one room — taken before they're
 * removed, so an undo puts them back exactly as they were. */
export type MembershipSnapshot = {
  roomId: string;
  identity: string;
  joinedAt: string | null;
  mood: string | null;
  lastCheckIn: string | null;
  checkins: number | null;
  chatCount: number | null;
  country: string | null;
  /** Their browsers' new-message alerts in this room (subscription ids). */
  alertSubscriptions: string[];
};

export async function snapshotMembership(roomId: string, identity: string): Promise<MembershipSnapshot> {
  const redis = requireRedis();
  const [joinedAt, mood, lastCheckIn, checkins, chatCount, country, subscribers] = await redis
    .pipeline()
    .hget(participantsKey(roomId), identity)
    .hget(moodKey(roomId), identity)
    .hget(presenceKey(roomId), identity)
    .hget(checkinCountKey(roomId), identity)
    .hget(chatCountKey(roomId), identity)
    .hget(countryKey(roomId), identity)
    .hgetall(roomSubscribersKey(roomId))
    .exec<
      [
        string | null,
        string | null,
        string | null,
        number | string | null,
        number | string | null,
        string | null,
        Record<string, string> | null,
      ]
    >();
  const toNumber = (value: number | string | null) => (value === null ? null : Number(value) || 0);
  return {
    roomId,
    identity,
    joinedAt: joinedAt ?? null,
    mood: mood ?? null,
    lastCheckIn: lastCheckIn ?? null,
    checkins: toNumber(checkins),
    chatCount: toNumber(chatCount),
    country: country ?? null,
    alertSubscriptions: Object.entries(subscribers ?? {})
      .filter(([, owner]) => owner === identity)
      .map(([subscriptionId]) => subscriptionId),
  };
}

/** Same effect as the person pressing "Stop waiting" themselves (see
 * leaveRoom in lib/rooms.ts): out of the room, and their mood, check-ins,
 * country and alerts go with them. Their messages stay in the chat. */
export async function removeMembership(snapshot: MembershipSnapshot): Promise<void> {
  const redis = requireRedis();
  const { roomId, identity, alertSubscriptions } = snapshot;
  const pipeline = redis
    .pipeline()
    .hdel(participantsKey(roomId), identity)
    .srem(joinedRoomsKey(identity), roomId)
    .hdel(moodKey(roomId), identity)
    .hdel(presenceKey(roomId), identity)
    .hdel(checkinCountKey(roomId), identity)
    .hdel(chatCountKey(roomId), identity)
    .hdel(countryKey(roomId), identity)
    .hdel(roomViewingKey(roomId), identity);
  if (alertSubscriptions.length > 0) {
    pipeline.hdel(roomSubscribersKey(roomId), ...alertSubscriptions);
    pipeline.hdel(roomAlertedKey(roomId), ...alertSubscriptions);
  }
  await pipeline.exec();
}

export async function restoreMembership(snapshot: MembershipSnapshot): Promise<void> {
  const redis = requireRedis();
  const { roomId, identity } = snapshot;
  const pipeline = redis
    .pipeline()
    .hset(participantsKey(roomId), { [identity]: snapshot.joinedAt ?? new Date().toISOString() })
    .sadd(joinedRoomsKey(identity), roomId);
  if (snapshot.mood) pipeline.hset(moodKey(roomId), { [identity]: snapshot.mood });
  if (snapshot.lastCheckIn) pipeline.hset(presenceKey(roomId), { [identity]: snapshot.lastCheckIn });
  if (snapshot.checkins !== null) pipeline.hset(checkinCountKey(roomId), { [identity]: snapshot.checkins });
  if (snapshot.chatCount !== null) pipeline.hset(chatCountKey(roomId), { [identity]: snapshot.chatCount });
  if (snapshot.country) pipeline.hset(countryKey(roomId), { [identity]: snapshot.country });
  snapshot.alertSubscriptions.forEach((subscriptionId) =>
    pipeline.hset(roomSubscribersKey(roomId), { [subscriptionId]: identity }),
  );
  await pipeline.exec();
}

// ---------------------------------------------------------------------------
// Chat

function parseStoredMessage(raw: string): ChatMessage | null {
  try {
    const message = JSON.parse(raw) as ChatMessage;
    return message && typeof message.id === "string" && typeof message.createdAt === "string"
      ? message
      : null;
  } catch {
    return null;
  }
}

/** A room's stored chat exactly as Redis holds it, newest first. */
async function getRawMessages(roomId: string): Promise<string[]> {
  const raw = requireRawRedis();
  return ((await raw.lrange(chatKey(roomId), 0, -1)) as unknown[]).filter(
    (entry): entry is string => typeof entry === "string",
  );
}

export async function getRoomMessagesById(
  roomIds: string[],
): Promise<Record<string, { raw: string; message: ChatMessage }[]>> {
  const raw = getRawRedis();
  if (!raw || roomIds.length === 0) return {};
  const pipeline = raw.pipeline();
  roomIds.forEach((roomId) => pipeline.lrange(chatKey(roomId), 0, -1));
  const lists = await pipeline.exec<unknown[][]>();
  const byRoom: Record<string, { raw: string; message: ChatMessage }[]> = {};
  roomIds.forEach((roomId, i) => {
    byRoom[roomId] = (lists[i] ?? []).flatMap((entry) => {
      if (typeof entry !== "string") return [];
      const message = parseStoredMessage(entry);
      return message ? [{ raw: entry, message }] : [];
    });
  });
  return byRoom;
}

export async function findMessage(
  roomId: string,
  messageId: string,
): Promise<{ raw: string; message: ChatMessage }> {
  for (const raw of await getRawMessages(roomId)) {
    const message = parseStoredMessage(raw);
    if (message?.id === messageId) return { raw, message };
  }
  throw new AdminError("That message is already gone.", 404);
}

export async function removeRawMessages(roomId: string, raws: string[]): Promise<number> {
  if (raws.length === 0) return 0;
  const raw = requireRawRedis();
  const pipeline = raw.pipeline();
  raws.forEach((entry) => pipeline.lrem(chatKey(roomId), 1, entry));
  const removed = await pipeline.exec<number[]>();
  return removed.reduce((sum, n) => sum + (Number(n) || 0), 0);
}

/** Puts messages back into a room's chat in their original places by time,
 * around anything posted since. Uses LINSERT against existing messages
 * (never a rewrite of the whole list), so a message someone sends at the
 * same moment isn't lost. */
export async function reinsertRawMessages(roomId: string, raws: string[]): Promise<void> {
  const raw = requireRawRedis();
  const current = await getRawMessages(roomId);
  const currentMessages = current
    .map((entry) => ({ entry, message: parseStoredMessage(entry) }))
    .filter((item): item is { entry: string; message: ChatMessage } => item.message !== null);
  const presentIds = new Set(currentMessages.map((item) => item.message.id));

  const toInsert = raws
    .map((entry) => ({ entry, message: parseStoredMessage(entry) }))
    .filter(
      (item): item is { entry: string; message: ChatMessage } =>
        item.message !== null && !presentIds.has(item.message.id),
    )
    // Newest first: each goes in just before the first current message
    // older than it, so ones sharing that spot must go in newest-first to
    // end up in order.
    .sort((a, b) => b.message.createdAt.localeCompare(a.message.createdAt));
  if (toInsert.length === 0) return;

  const pipeline = raw.pipeline();
  for (const item of toInsert) {
    const pivot = currentMessages.find((existing) => existing.message.createdAt < item.message.createdAt);
    if (pivot) pipeline.linsert(chatKey(roomId), "before", pivot.entry, item.entry);
    else pipeline.rpush(chatKey(roomId), item.entry);
  }
  pipeline.ltrim(chatKey(roomId), 0, MAX_STORED_CHAT_MESSAGES - 1);
  await pipeline.exec();
}

export async function clearRoomChat(roomId: string): Promise<string[]> {
  const raws = await getRawMessages(roomId);
  if (raws.length === 0) throw new AdminError("There are no messages to clear.", 400);
  await removeRawMessages(roomId, raws);
  return raws;
}

export async function postSystemMessage(roomId: string, text: string): Promise<{ raw: string; message: ChatMessage }> {
  const raw = requireRawRedis();
  const message: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    identity: SYSTEM_IDENTITY,
    displayName: SYSTEM_DISPLAY_NAME,
    color: SYSTEM_COLOR,
    text,
    createdAt: new Date().toISOString(),
  };
  // Stored as the exact same JSON the normal send path writes, so it can be
  // matched and removed again byte for byte on undo.
  const entry = JSON.stringify(message);
  await raw
    .pipeline()
    .lpush(chatKey(roomId), entry)
    .ltrim(chatKey(roomId), 0, MAX_STORED_CHAT_MESSAGES - 1)
    .exec();
  return { raw: entry, message };
}

export function toAdminMessage(roomId: string, message: ChatMessage): AdminMessage {
  return {
    id: message.id,
    roomId,
    identity: message.identity,
    kind: personKind(message.identity),
    displayName: message.displayName,
    color: message.color,
    text: message.text,
    createdAt: message.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Detail

export async function getAdminRoomDetail(id: string): Promise<AdminRoomDetail> {
  const redis = requireRedis();
  const located = await requireRoom(id);

  const [participants, moods, presence, chatCounts, countries] = await redis
    .pipeline()
    .hgetall(participantsKey(id))
    .hgetall(moodKey(id))
    .hgetall(presenceKey(id))
    .hgetall(chatCountKey(id))
    .hgetall(countryKey(id))
    .exec<(Record<string, string | number> | null)[]>();
  const messagesById = await getRoomMessagesById([id]);
  const stored = messagesById[id] ?? [];

  const participantIds = Object.keys(participants ?? {});
  const [people, suspended] = await Promise.all([
    resolvePeople(participantIds),
    getSuspendedIdentities(),
  ]);

  const moodCounts = new Map<string, number>();
  Object.values(moods ?? {}).forEach((mood) => moodCounts.set(String(mood), (moodCounts.get(String(mood)) ?? 0) + 1));
  const countryCounts = new Map<string, number>();
  Object.values(countries ?? {}).forEach((code) =>
    countryCounts.set(String(code), (countryCounts.get(String(code)) ?? 0) + 1),
  );

  const participantList = participantIds
    .map((identity) => {
      const person = people.get(identity);
      return {
        identity,
        kind: personKind(identity),
        name: person?.name ?? identity,
        image: person?.image ?? null,
        joinedAt: participants?.[identity] ? String(participants[identity]) : null,
        country: countries?.[identity] ? String(countries[identity]) : null,
        mood: moods?.[identity] ? String(moods[identity]) : null,
        lastCheckIn: presence?.[identity] ? String(presence[identity]) : null,
        messageCount: Number(chatCounts?.[identity] ?? 0) || 0,
        isHost: identity === located.room.createdBy,
        suspended: suspended.has(identity),
      };
    })
    .sort((a, b) => (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0) || (b.joinedAt ?? "").localeCompare(a.joinedAt ?? ""));

  return {
    room: toAdminRoom(located.room, {
      participantCount: participantIds.length,
      messageCount: stored.length,
      trashedAt: located.trashedAt,
      imageVersion: imageVersionOf(located.room.imageUrl),
    }),
    participants: participantList,
    // Oldest first, like the chat itself reads.
    messages: stored.map(({ message }) => toAdminMessage(id, message)).reverse(),
    moods: Array.from(moodCounts, ([mood, count]) => ({ mood, count })).sort((a, b) => b.count - a.count),
    countries: Array.from(countryCounts, ([code, count]) => ({ code, count })).sort(
      (a, b) => b.count - a.count || a.code.localeCompare(b.code),
    ),
  };
}
