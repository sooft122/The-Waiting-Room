import { getRedis } from "./redis";
import { clearMoodVote, getMoodBreakdown, type Mood, type MoodBreakdown } from "./roomMood";
import { clearPresence } from "./roomPresence";
import { clearChatCount } from "./roomChat";
import { clearParticipantCountry } from "./roomCountry";
import { getRoomEndTime } from "./roomTime";

export { getRoomEndTime, parseRoomTime } from "./roomTime";

export const ROOM_CATEGORIES = [
  "Sports",
  "Entertainment",
  "Gaming",
  "Technology",
  "Culture",
  "Events",
  "Other",
] as const;

export type RoomCategory = (typeof ROOM_CATEGORIES)[number];

export type Room = {
  id: string;
  name: string;
  /** ISO date (yyyy-mm-dd) — when the room stops waiting. */
  date: string;
  /** Optional 24h "HH:mm" time of day the wait ends. Null (or missing, for
   * rooms created before this field existed) means the countdown/active
   * checks fall back to UTC midnight on `date` — see getRoomEndTime. */
  time: string | null;
  category: RoomCategory;
  /** Data URI of the uploaded thumbnail. */
  imageUrl: string;
  /** Stable identity of the creator: an account email or "anon:<id>". */
  createdBy: string;
  /** Display label for the creator, e.g. "Anonymous #4" or a Google name. */
  createdByLabel: string;
  /** ISO 3166-1 alpha-2 country the creator made the room from (Vercel's own
   * IP-geolocation header) — null when that header wasn't available, e.g. a
   * room created outside of Vercel's edge network (local dev). A permanent
   * record, independent of roomCountry.ts's live "who's currently waiting
   * from where" tracking, which would otherwise forget the creator's
   * country if they ever left their own room. */
  createdByCountry: string | null;
  /** Live count of joined participants — always recomputed from the
   * participants hash at read time, never stored/trusted as a static field. */
  participantCount: number;
  createdAt: string;
  /** Optional longer write-up shown on the room page's "Description" tab.
   * Null for rooms created before this field existed, or when the creator
   * left it blank. */
  description: string | null;
  /** Optional redirect button shown under the description — both null
   * unless the creator filled in a description first (the create-room
   * form only allows these once a description is present). */
  ctaText: string | null;
  ctaLink: string | null;
};

export type CreateRoomInput = {
  name: string;
  date: string;
  time: string | null;
  category: RoomCategory;
  imageUrl: string;
  createdBy: string;
  createdByLabel: string;
  createdByCountry: string | null;
  description: string | null;
  ctaText: string | null;
  ctaLink: string | null;
};

export type UpdateRoomInput = {
  name: string;
  date: string;
  time: string | null;
  category: RoomCategory;
  imageUrl: string;
};

export type RoomAnalytics = {
  /** Days between room creation and its end date. */
  totalWaitDays: number;
  /** Average of (end date - each participant's join time), in days. */
  averageWaitDays: number;
  peopleWhoWaited: number;
  topMood: Mood | null;
};

const ROOMS_INDEX_KEY = "waiting-room:rooms:index";
const roomKey = (id: string) => `waiting-room:rooms:room:${id}`;
// A hash (not a set) so each participant's join time is tracked alongside
// membership — needed for "waiting since" and average-wait analytics.
const participantsKey = (roomId: string) => `waiting-room:rooms:participants:${roomId}`;
const joinedRoomsKey = (identity: string) => `waiting-room:users:joined:${identity}`;

export function isRoomCategory(value: unknown): value is RoomCategory {
  return typeof value === "string" && (ROOM_CATEGORIES as readonly string[]).includes(value);
}

/** Whether a room's wait is still ongoing (its end date/time hasn't passed yet). */
export function isRoomActive(room: Room): boolean {
  return getRoomEndTime(room).getTime() > Date.now();
}

const STARTING_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Whether a room is still active but its countdown has less than 24 hours
 * left — the event it's counting down to is about to happen. */
export function isRoomStartingSoon(room: Room): boolean {
  const msRemaining = getRoomEndTime(room).getTime() - Date.now();
  return msRemaining > 0 && msRemaining <= STARTING_SOON_WINDOW_MS;
}

async function getParticipantCount(roomId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  return redis.hlen(participantsKey(roomId));
}

export async function createRoom(input: CreateRoomInput): Promise<Room> {
  const redis = getRedis();
  if (!redis) {
    throw new Error("Room storage is not configured.");
  }

  const room: Room = {
    ...input,
    id: crypto.randomUUID(),
    participantCount: 0,
    createdAt: new Date().toISOString(),
  };

  await Promise.all([redis.set(roomKey(room.id), room), redis.lpush(ROOMS_INDEX_KEY, room.id)]);

  return room;
}

export async function updateRoom(id: string, updates: UpdateRoomInput): Promise<Room | null> {
  const redis = getRedis();
  if (!redis) throw new Error("Room storage is not configured.");

  const existing = await redis.get<Room>(roomKey(id));
  if (!existing) return null;

  const updated: Room = { ...existing, ...updates };
  // The write and the participant-count read are independent — run together.
  const [, participantCount] = await Promise.all([
    redis.set(roomKey(id), updated),
    getParticipantCount(id),
  ]);
  return { ...updated, participantCount };
}

export async function deleteRoom(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Room storage is not configured.");

  await Promise.all([
    redis.del(roomKey(id)),
    redis.lrem(ROOMS_INDEX_KEY, 0, id),
    redis.del(participantsKey(id)),
  ]);
}

/** Fetches room objects and their live participant counts in one parallel
 * round trip — the count only needs the id, not the fetched room, so there's
 * no real reason to wait for the room read before starting it. */
async function getRoomsWithCounts(ids: string[]): Promise<Room[]> {
  const redis = getRedis();
  if (!redis || ids.length === 0) return [];

  const [rooms, counts] = await Promise.all([
    Promise.all(ids.map((id) => redis.get<Room>(roomKey(id)))),
    Promise.all(ids.map((id) => getParticipantCount(id))),
  ]);

  const found: Room[] = [];
  rooms.forEach((room, i) => {
    if (room) found.push({ ...room, participantCount: counts[i] });
  });
  return found;
}

export async function listRooms(): Promise<Room[]> {
  const redis = getRedis();
  if (!redis) return [];

  const ids = await redis.lrange<string>(ROOMS_INDEX_KEY, 0, -1);
  return getRoomsWithCounts(ids);
}

export async function getRoom(id: string): Promise<Room | null> {
  const rooms = await getRoomsWithCounts([id]);
  return rooms[0] ?? null;
}

export async function getRoomsByIds(ids: string[]): Promise<Room[]> {
  return getRoomsWithCounts(ids);
}

/** Idempotent — joining twice keeps the original join time. */
export async function joinRoom(identity: string, roomId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Room storage is not configured.");

  const alreadyJoined = await redis.hexists(participantsKey(roomId), identity);
  await Promise.all([
    alreadyJoined
      ? Promise.resolve()
      : redis.hset(participantsKey(roomId), { [identity]: new Date().toISOString() }),
    redis.sadd(joinedRoomsKey(identity), roomId),
  ]);
}

/** Leaving takes the identity's Room Energy contributions with it — their
 * mood vote, check-in history, chat-count tally, and recorded country are
 * all cleared, not just their spot in the participant count. Someone no
 * longer waiting shouldn't keep influencing a room's mood, energy, or
 * "where the world is waiting from". Their chat messages and assigned
 * color stay put — leaving doesn't rewrite the room's chat history, only
 * the live "currently contributing" signals. */
export async function leaveRoom(identity: string, roomId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Room storage is not configured.");

  await Promise.all([
    redis.hdel(participantsKey(roomId), identity),
    redis.srem(joinedRoomsKey(identity), roomId),
    clearMoodVote(roomId, identity),
    clearPresence(roomId, identity),
    clearChatCount(roomId, identity),
    clearParticipantCountry(roomId, identity),
  ]);
}

export async function hasJoinedRoom(identity: string, roomId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const result = await redis.hexists(participantsKey(roomId), identity);
  return result === 1;
}

/** ISO timestamp of when this identity joined this room, or null. */
export async function getJoinedAt(identity: string, roomId: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const value = await redis.hget<string>(participantsKey(roomId), identity);
  return value ?? null;
}

export async function getJoinedRoomIds(identity: string): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];
  return redis.smembers(joinedRoomsKey(identity));
}

/**
 * Stats shown on the "wait has ended" room page. All derived from data we
 * actually track — participant join times and real mood votes — nothing
 * here is fabricated.
 */
export async function getRoomAnalytics(room: Room): Promise<RoomAnalytics> {
  const redis = getRedis();
  const endMs = getRoomEndTime(room).getTime();
  const createdMs = new Date(room.createdAt).getTime();
  const totalWaitDays = Math.max(0, Math.round((endMs - createdMs) / 86_400_000));

  const participants = redis
    ? ((await redis.hgetall<Record<string, string>>(participantsKey(room.id))) ?? {})
    : {};
  const joinTimesMs = Object.values(participants).map((iso) => new Date(iso).getTime());
  const averageWaitDays = joinTimesMs.length
    ? Math.round(
        joinTimesMs.reduce((sum, joinedMs) => sum + Math.max(0, endMs - joinedMs), 0) /
          joinTimesMs.length /
          86_400_000,
      )
    : 0;

  const { breakdown } = await getMoodBreakdown(room.id);
  const topMoodEntry = breakdown.reduce<MoodBreakdown | null>(
    (best, current) => (current.count > (best?.count ?? -1) ? current : best),
    null,
  );

  return {
    totalWaitDays,
    averageWaitDays,
    peopleWhoWaited: room.participantCount,
    topMood: topMoodEntry && topMoodEntry.count > 0 ? topMoodEntry.mood : null,
  };
}
