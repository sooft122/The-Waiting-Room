import { createHash } from "crypto";
import { getRedis } from "./redis";
import type { PushSubscriptionRecord } from "./pushSubscription";

// One record per browser subscription, keyed by a hash of its endpoint — the
// endpoint is a delivery address, so it's never used as a key or put in URLs.
const subscriptionKey = (subscriptionId: string) => `waiting-room:push:subscription:${subscriptionId}`;
// Per room: which subscriptions have new-message alerts on (id → identity)…
const roomSubscribersKey = (roomId: string) => `waiting-room:push:room-subscribers:${roomId}`;
// …when each was last alerted (id → ms)…
const roomAlertedKey = (roomId: string) => `waiting-room:push:room-alerted:${roomId}`;
// …and when each participant's room page last reported itself visible (identity → ms).
const roomViewingKey = (roomId: string) => `waiting-room:rooms:viewing:${roomId}`;

/** Stable id for a subscription — pushClient.ts derives the same one in the browser. */
export function subscriptionIdFor(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

export function isSubscriptionId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function toTimes(raw: Record<string, unknown> | null): Record<string, number> {
  const times: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    const time = Number(value);
    if (value !== null && Number.isFinite(time)) times[key] = time;
  }
  return times;
}

export async function enableRoomAlerts(
  roomId: string,
  identity: string,
  subscription: PushSubscriptionRecord,
): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Room storage is not configured.");

  const subscriptionId = subscriptionIdFor(subscription.endpoint);
  await Promise.all([
    redis.set(subscriptionKey(subscriptionId), subscription),
    redis.hset(roomSubscribersKey(roomId), { [subscriptionId]: identity }),
  ]);
}

export async function disableRoomAlerts(roomId: string, subscriptionId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Room storage is not configured.");

  await Promise.all([
    redis.hdel(roomSubscribersKey(roomId), subscriptionId),
    redis.hdel(roomAlertedKey(roomId), subscriptionId),
  ]);
}

/** Whether this browser subscription has alerts on for this room — and can
 * still get them (its record goes once its push service reports it dead). If
 * they were turned on under another identity (say, as Anonymous before
 * signing in), they're re-pointed at the current one, so "not your own
 * messages" and "not while you're looking" follow whoever is actually using
 * the browser. */
export async function getRoomAlertsEnabled(
  roomId: string,
  subscriptionId: string,
  identity: string,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const [owner, stored] = await Promise.all([
    redis.hget<string>(roomSubscribersKey(roomId), subscriptionId),
    redis.exists(subscriptionKey(subscriptionId)),
  ]);
  if (!owner || !stored) return false;
  if (owner !== identity) {
    await redis.hset(roomSubscribersKey(roomId), { [subscriptionId]: identity });
  }
  return true;
}

/** Turns off every alert this identity set up in the room — on leaving it. */
export async function clearRoomAlertsForIdentity(roomId: string, identity: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const subscribers = (await redis.hgetall<Record<string, string>>(roomSubscribersKey(roomId))) ?? {};
  const theirs = Object.keys(subscribers).filter((id) => subscribers[id] === identity);
  await Promise.all([
    theirs.length > 0 ? redis.hdel(roomSubscribersKey(roomId), ...theirs) : null,
    theirs.length > 0 ? redis.hdel(roomAlertedKey(roomId), ...theirs) : null,
    redis.hdel(roomViewingKey(roomId), identity),
  ]);
}

/** Drops all of a room's alert bookkeeping — on deleting the room. */
export async function clearRoomAlerts(roomId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(roomSubscribersKey(roomId), roomAlertedKey(roomId), roomViewingKey(roomId));
}

/** Records that this participant has the room open and visible right now. */
export async function markViewingRoom(roomId: string, identity: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.hset(roomViewingKey(roomId), { [identity]: Date.now() });
}

/** Subscription id → identity, for every subscription with alerts on here. */
export async function getRoomSubscribers(roomId: string): Promise<Record<string, string>> {
  const redis = getRedis();
  if (!redis) return {};
  return (await redis.hgetall<Record<string, string>>(roomSubscribersKey(roomId))) ?? {};
}

export async function getRoomAlertState(
  roomId: string,
  identities: string[],
): Promise<{ lastViewedAt: Record<string, number>; lastAlertedAt: Record<string, number> }> {
  const redis = getRedis();
  if (!redis || identities.length === 0) return { lastViewedAt: {}, lastAlertedAt: {} };

  const [viewed, alerted] = await Promise.all([
    redis.hmget<Record<string, unknown>>(roomViewingKey(roomId), ...identities),
    redis.hgetall<Record<string, unknown>>(roomAlertedKey(roomId)),
  ]);
  return { lastViewedAt: toTimes(viewed), lastAlertedAt: toTimes(alerted) };
}

export async function recordRoomAlerts(roomId: string, subscriptionIds: string[], at: number): Promise<void> {
  const redis = getRedis();
  if (!redis || subscriptionIds.length === 0) return;
  await redis.hset(
    roomAlertedKey(roomId),
    Object.fromEntries(subscriptionIds.map((id) => [id, at])),
  );
}

/** Stored subscriptions, in the same order as `subscriptionIds` (null where gone). */
export async function getSubscriptions(
  subscriptionIds: string[],
): Promise<(PushSubscriptionRecord | null)[]> {
  const redis = getRedis();
  if (!redis || subscriptionIds.length === 0) return subscriptionIds.map(() => null);
  return redis.mget<(PushSubscriptionRecord | null)[]>(...subscriptionIds.map(subscriptionKey));
}

/** Forgets a subscription the browser has dropped (its push service answered
 * 404/410). Other rooms still listing it are tidied up the next time they
 * find its record missing. */
export async function forgetSubscription(roomId: string, subscriptionId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await Promise.all([
    redis.del(subscriptionKey(subscriptionId)),
    redis.hdel(roomSubscribersKey(roomId), subscriptionId),
    redis.hdel(roomAlertedKey(roomId), subscriptionId),
  ]);
}
