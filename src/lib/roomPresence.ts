import { getRedis } from "./redis";
import { CHECK_IN_COOLDOWN_MS, hashIdentity } from "./roomPresenceConstants";

export { PRESENCE_WINDOW_MS, CHECK_IN_COOLDOWN_MS } from "./roomPresenceConstants";

export type GlowingSeed = { dotSeed: number; colorSeed: number };

const presenceKey = (roomId: string) => `waiting-room:rooms:presence:${roomId}`;
// Cumulative count of check-ins per identity — never decreases, unlike the
// presence hash above (which only tracks the *last* check-in time). This is
// what lets Room Energy reward "kept checking in" as an ongoing signal
// rather than a one-time "currently present" flag.
const checkinCountKey = (roomId: string) => `waiting-room:rooms:checkin-count:${roomId}`;

export async function checkIn(roomId: string, identity: string): Promise<string> {
  const redis = getRedis();
  if (!redis) throw new Error("Room storage is not configured.");
  const now = new Date().toISOString();
  await Promise.all([
    redis.hset(presenceKey(roomId), { [identity]: now }),
    redis.hincrby(checkinCountKey(roomId), identity, 1),
  ]);
  return now;
}

/** Clears this identity's check-in history — called when they stop waiting,
 * so their Room Energy boost leaves with them instead of lingering from
 * someone no longer in the room, and a later rejoin starts its cooldown
 * fresh instead of inheriting a stale "still here" timer. */
export async function clearPresence(roomId: string, identity: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await Promise.all([
    redis.hdel(presenceKey(roomId), identity),
    redis.hdel(checkinCountKey(roomId), identity),
  ]);
}

export async function getLastSeen(roomId: string, identity: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const value = await redis.hget<string>(presenceKey(roomId), identity);
  return value ?? null;
}

/** Anonymous seeds for every identity currently within the check-in cooldown
 * window (i.e. still "glowing" in the Lobby) — hashed so this can be polled
 * by every viewer of the room without ever exposing raw identities (which
 * can be a real signed-in email) to someone else's browser. */
export async function getGlowingSeeds(roomId: string): Promise<GlowingSeed[]> {
  const redis = getRedis();
  if (!redis) return [];
  const raw = (await redis.hgetall<Record<string, string>>(presenceKey(roomId))) ?? {};
  const now = Date.now();
  const seeds: GlowingSeed[] = [];
  for (const [identity, lastSeenIso] of Object.entries(raw)) {
    if (now - new Date(lastSeenIso).getTime() < CHECK_IN_COOLDOWN_MS) {
      seeds.push({ dotSeed: hashIdentity(identity), colorSeed: hashIdentity(`${identity}:color`) });
    }
  }
  return seeds;
}

/** Each identity's total number of check-ins ever (join counts as the first). */
export async function getCheckinCounts(roomId: string): Promise<Record<string, number>> {
  const redis = getRedis();
  if (!redis) return {};
  const raw = (await redis.hgetall<Record<string, number | string>>(checkinCountKey(roomId))) ?? {};
  const counts: Record<string, number> = {};
  for (const [identity, value] of Object.entries(raw)) {
    counts[identity] = Number(value) || 0;
  }
  return counts;
}
