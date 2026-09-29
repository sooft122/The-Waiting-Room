import { createHash } from "crypto";
import { getRedis } from "@/lib/redis";
import { chatCountKey } from "@/lib/roomChat";
import { moodKey } from "@/lib/roomMood";
import { presenceKey } from "@/lib/roomPresence";
import { countryKey } from "@/lib/roomCountry";
import { joinedRoomsKey, participantsKey } from "@/lib/rooms";
import { profileKey, type Profile } from "@/lib/profile";
import { ACCOUNTS_KEY, LAST_SEEN_KEY, type AccountInfo } from "@/lib/peopleActivity";
import { getSuspendedIdentities } from "@/lib/suspension";
import { AdminError } from "./errors";
import { getRoomMessagesById, toAdminMessage } from "./rooms";
import type { AdminPerson, AdminPersonDetail, AdminRoom, PersonKind } from "./types";

// Every key under this prefix is either someone's profile
// ("waiting-room:users:<identity>") or the set of rooms they've joined
// ("waiting-room:users:joined:<identity>").
const USERS_PREFIX = "waiting-room:users:";
const JOINED_PREFIX = "waiting-room:users:joined:";

export const MAX_NAME_LENGTH = 40;

export function personKind(identity: string): PersonKind {
  if (identity.startsWith("anon:")) return "anonymous";
  if (identity.startsWith("system:")) return "system";
  return "google";
}

function anonNumber(identity: string): number | null {
  if (!identity.startsWith("anon:")) return null;
  const number = Number(identity.slice(5));
  return Number.isFinite(number) ? number : null;
}

function defaultName(identity: string, account: AccountInfo | null): string {
  if (identity.startsWith("anon:")) return `Anonymous #${identity.slice(5)}`;
  if (identity.startsWith("system:")) return "The Waiting Room";
  return account?.name || identity.split("@")[0];
}

/** URL for someone's uploaded photo — through the admin image route, since
 * it's stored inline and can be megabytes; the version busts the cache when
 * it changes. */
function uploadedPhotoUrl(identity: string, avatarUrl: string): string {
  const version = createHash("sha1").update(avatarUrl).digest("hex").slice(0, 12);
  return `/api/admin/image?person=${encodeURIComponent(identity)}&v=${version}`;
}

type PersonBasics = { name: string; image: string | null; profile: Profile | null; account: AccountInfo | null };

/** Names and photos for a handful of people (a room's participants). */
export async function resolvePeople(identities: string[]): Promise<Map<string, PersonBasics>> {
  const redis = getRedis();
  const people = new Map<string, PersonBasics>();
  if (!redis || identities.length === 0) return people;

  const [profiles, accounts] = await Promise.all([
    redis.mget<(Profile | null)[]>(...identities.map(profileKey)),
    redis.hmget<Record<string, AccountInfo>>(ACCOUNTS_KEY, ...identities),
  ]);
  identities.forEach((identity, i) => {
    const profile = profiles[i] ?? null;
    const account = accounts?.[identity] ?? null;
    people.set(identity, {
      name: profile?.displayName || defaultName(identity, account),
      image: profile?.avatarUrl ? uploadedPhotoUrl(identity, profile.avatarUrl) : account?.image ?? null,
      profile,
      account,
    });
  });
  return people;
}

async function scanUserKeys(): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];
  const keys: string[] = [];
  let cursor: string | number = 0;
  do {
    const [next, batch]: [string | number, string[]] = await redis.scan(cursor, {
      match: `${USERS_PREFIX}*`,
      count: 1000,
    });
    keys.push(...batch);
    cursor = next;
  } while (String(cursor) !== "0");
  return keys;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function buildPerson(
  identity: string,
  profile: Profile | null,
  account: AccountInfo | null,
  extras: { lastSeenAt: string | null; roomsJoined: number; roomsCreated: number; suspended: boolean },
): AdminPerson {
  return {
    identity,
    kind: personKind(identity),
    name: profile?.displayName || defaultName(identity, account),
    email: personKind(identity) === "google" ? identity : null,
    anonNumber: anonNumber(identity),
    image: profile?.avatarUrl ? uploadedPhotoUrl(identity, profile.avatarUrl) : account?.image ?? null,
    nameOverride: profile?.displayName ?? null,
    hasUploadedPhoto: !!profile?.avatarUrl,
    firstSeenAt: profile?.joinedAt ?? null,
    lastSeenAt: extras.lastSeenAt,
    roomsJoined: extras.roomsJoined,
    roomsCreated: extras.roomsCreated,
    suspended: extras.suspended,
  };
}

/** Everyone who has ever had a profile, joined a room or created one —
 * Google accounts and Anonymous visitors alike. */
export async function listAdminPeople(rooms: AdminRoom[]): Promise<AdminPerson[]> {
  const redis = getRedis();
  if (!redis) return [];

  const keys = await scanUserKeys();
  const profileIdentities: string[] = [];
  const joinedIdentities: string[] = [];
  for (const key of keys) {
    if (key.startsWith(JOINED_PREFIX)) joinedIdentities.push(key.slice(JOINED_PREFIX.length));
    else profileIdentities.push(key.slice(USERS_PREFIX.length));
  }

  const createdCounts = new Map<string, number>();
  for (const room of rooms) {
    if (room.trashedAt) continue;
    createdCounts.set(room.createdBy, (createdCounts.get(room.createdBy) ?? 0) + 1);
  }

  const identities = Array.from(
    new Set([...profileIdentities, ...joinedIdentities, ...Array.from(createdCounts.keys())]),
  ).filter((identity) => identity && personKind(identity) !== "system");

  const profileChunks = chunk(profileIdentities, 300);
  const pipeline = redis.pipeline();
  profileChunks.forEach((ids) => pipeline.mget(...ids.map(profileKey)));
  pipeline.hgetall(LAST_SEEN_KEY);
  pipeline.hgetall(ACCOUNTS_KEY);
  joinedIdentities.forEach((identity) => pipeline.scard(joinedRoomsKey(identity)));
  const results = await pipeline.exec<unknown[]>();

  const profiles = new Map<string, Profile>();
  profileChunks.forEach((ids, chunkIndex) => {
    const values = (results[chunkIndex] as (Profile | null)[]) ?? [];
    ids.forEach((identity, i) => {
      const profile = values[i];
      if (profile) profiles.set(identity, profile);
    });
  });
  let cursor = profileChunks.length;
  const lastSeen = (results[cursor++] as Record<string, string> | null) ?? {};
  const accounts = (results[cursor++] as Record<string, AccountInfo> | null) ?? {};
  const joinedCounts = new Map<string, number>();
  joinedIdentities.forEach((identity, i) => joinedCounts.set(identity, Number(results[cursor + i]) || 0));
  const suspended = await getSuspendedIdentities();

  return identities.map((identity) =>
    buildPerson(identity, profiles.get(identity) ?? null, accounts[identity] ?? null, {
      lastSeenAt: lastSeen[identity] ?? null,
      roomsJoined: joinedCounts.get(identity) ?? 0,
      roomsCreated: createdCounts.get(identity) ?? 0,
      suspended: suspended.has(identity),
    }),
  );
}

export async function getAdminPerson(identity: string, rooms: AdminRoom[]): Promise<AdminPerson> {
  const redis = getRedis();
  if (!redis) throw new AdminError("Storage isn't configured.", 503);
  const [profile, lastSeenAt, account, roomsJoined, suspended] = await Promise.all([
    redis.get<Profile>(profileKey(identity)),
    redis.hget<string>(LAST_SEEN_KEY, identity),
    redis.hget<AccountInfo>(ACCOUNTS_KEY, identity),
    redis.scard(joinedRoomsKey(identity)),
    getSuspendedIdentities(),
  ]);
  const roomsCreated = rooms.filter((room) => !room.trashedAt && room.createdBy === identity).length;
  if (!profile && roomsJoined === 0 && roomsCreated === 0 && !suspended.has(identity)) {
    throw new AdminError("There's no one with that identity.", 404);
  }
  return buildPerson(identity, profile ?? null, account ?? null, {
    lastSeenAt: lastSeenAt ?? null,
    roomsJoined,
    roomsCreated,
    suspended: suspended.has(identity),
  });
}

/** Someone's full picture: their rooms (with how they're taking part in
 * each), the messages they've sent, and their total time spent waiting. */
export async function getAdminPersonDetail(identity: string, rooms: AdminRoom[]): Promise<AdminPersonDetail> {
  const redis = getRedis();
  if (!redis) throw new AdminError("Storage isn't configured.", 503);
  const person = await getAdminPerson(identity, rooms);
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const joinedIds = (await redis.smembers(joinedRoomsKey(identity))).filter((id) => roomsById.has(id));

  const pipeline = redis.pipeline();
  joinedIds.forEach((roomId) => {
    pipeline.hget(participantsKey(roomId), identity);
    pipeline.hget(moodKey(roomId), identity);
    pipeline.hget(countryKey(roomId), identity);
    pipeline.hget(presenceKey(roomId), identity);
    pipeline.hget(chatCountKey(roomId), identity);
  });
  const values = joinedIds.length > 0 ? await pipeline.exec<unknown[]>() : [];

  const now = Date.now();
  let totalWaitMs = 0;
  const personRooms = joinedIds.map((roomId, i) => {
    const [joinedAt, mood, country, lastCheckIn, chatCount] = values.slice(i * 5, i * 5 + 5);
    const room = roomsById.get(roomId)!;
    const joinedMs = typeof joinedAt === "string" ? Date.parse(joinedAt) : NaN;
    // Same as the profile page's Total Wait Time: from joining until the
    // wait ended, or until now while it's still counting down.
    if (Number.isFinite(joinedMs) && !room.trashedAt) {
      totalWaitMs += Math.max(0, Math.min(now, Date.parse(room.endsAt)) - joinedMs);
    }
    return {
      room,
      joinedAt: typeof joinedAt === "string" ? joinedAt : null,
      mood: typeof mood === "string" ? mood : null,
      country: typeof country === "string" ? country : null,
      lastCheckIn: typeof lastCheckIn === "string" ? lastCheckIn : null,
      messageCount: Number(chatCount) || 0,
      isHost: room.createdBy === identity,
    };
  });
  personRooms.sort((a, b) => (b.joinedAt ?? "").localeCompare(a.joinedAt ?? ""));

  // Their messages anywhere — including rooms they've since left, since
  // leaving doesn't take messages out of the chat.
  const messagesByRoom = await getRoomMessagesById(rooms.map((room) => room.id));
  const messages = rooms
    .flatMap((room) =>
      (messagesByRoom[room.id] ?? [])
        .filter(({ message }) => message.identity === identity)
        .map(({ message }) => ({ ...toAdminMessage(room.id, message), roomName: room.name })),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);

  return { person, rooms: personRooms, messages, totalWaitMs };
}

/** The profile record as stored, creating the default one if they've never had one. */
export async function readProfileForEdit(identity: string): Promise<Profile> {
  const redis = getRedis();
  if (!redis) throw new AdminError("Storage isn't configured.", 503);
  const fallback: Profile = {
    identity,
    displayName: null,
    avatarUrl: null,
    joinedAt: new Date().toISOString(),
    isAnonymous: identity.startsWith("anon:"),
  };
  await redis.set(profileKey(identity), fallback, { nx: true });
  return (await redis.get<Profile>(profileKey(identity))) ?? fallback;
}

export async function writeProfile(profile: Profile): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new AdminError("Storage isn't configured.", 503);
  await redis.set(profileKey(profile.identity), profile);
}

export async function getProfilePhoto(identity: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const profile = await redis.get<Profile>(profileKey(identity));
  return profile?.avatarUrl ?? null;
}

export async function getJoinedRoomIdsFor(identity: string): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];
  return redis.smembers(joinedRoomsKey(identity));
}
