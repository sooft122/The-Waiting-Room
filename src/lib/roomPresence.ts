import { getRedis } from "./redis";

export { PRESENCE_WINDOW_MS, CHECK_IN_COOLDOWN_MS } from "./roomPresenceConstants";
import { PRESENCE_WINDOW_MS } from "./roomPresenceConstants";

const presenceKey = (roomId: string) => `waiting-room:rooms:presence:${roomId}`;

export async function checkIn(roomId: string, identity: string): Promise<string> {
  const redis = getRedis();
  if (!redis) throw new Error("Room storage is not configured.");
  const now = new Date().toISOString();
  await redis.hset(presenceKey(roomId), { [identity]: now });
  return now;
}

export async function getLastSeen(roomId: string, identity: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const value = await redis.hget<string>(presenceKey(roomId), identity);
  return value ?? null;
}

/** Count of participants who've checked in within PRESENCE_WINDOW_MS. */
export async function getRecentPresenceCount(roomId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  const map = (await redis.hgetall<Record<string, string>>(presenceKey(roomId))) ?? {};
  const cutoffMs = Date.now() - PRESENCE_WINDOW_MS;
  return Object.values(map).filter((iso) => new Date(iso).getTime() >= cutoffMs).length;
}
