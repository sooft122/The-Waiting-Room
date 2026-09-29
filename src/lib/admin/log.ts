import { getRedis } from "@/lib/redis";
import { AdminError } from "./errors";
import type { AdminLogEntry } from "./types";

// Every change made from the dashboard, newest first, each with what it
// needs to be undone (and redone).
const ENTRIES_KEY = "waiting-room:admin:log"; // hash: id → entry
const ORDER_KEY = "waiting-room:admin:log-order"; // sorted set: id by time
const snapshotKey = (id: string) => `waiting-room:admin:log-snapshot:${id}`;

/** How long a change stays undoable. */
export const UNDO_WINDOW_DAYS = 90;
const SNAPSHOT_TTL_SECONDS = UNDO_WINDOW_DAYS * 24 * 60 * 60;
const MAX_ENTRIES = 1000;

function requireRedis() {
  const redis = getRedis();
  if (!redis) throw new AdminError("Storage isn't configured.", 503);
  return redis;
}

export async function recordAction(
  entry: Omit<AdminLogEntry, "id" | "at" | "status" | "changedAt">,
  snapshot?: unknown,
): Promise<AdminLogEntry> {
  const redis = requireRedis();
  const full: AdminLogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    status: "done",
    changedAt: null,
  };

  const pipeline = redis.pipeline();
  pipeline.hset(ENTRIES_KEY, { [full.id]: full });
  pipeline.zadd(ORDER_KEY, { score: Date.now(), member: full.id });
  if (full.undoable && snapshot !== undefined) {
    pipeline.set(snapshotKey(full.id), snapshot, { ex: SNAPSHOT_TTL_SECONDS });
  }
  pipeline.zcard(ORDER_KEY);
  const results = await pipeline.exec();

  const count = Number(results[results.length - 1]) || 0;
  if (count > MAX_ENTRIES + 50) await trimLog(count - MAX_ENTRIES);
  return full;
}

async function trimLog(excess: number): Promise<void> {
  const redis = requireRedis();
  const oldest = await redis.zrange<string[]>(ORDER_KEY, 0, excess - 1);
  if (oldest.length === 0) return;
  await Promise.all([
    redis.zrem(ORDER_KEY, ...oldest),
    redis.hdel(ENTRIES_KEY, ...oldest),
    redis.del(...oldest.map(snapshotKey)),
  ]);
}

export async function listActions(limit = 200): Promise<AdminLogEntry[]> {
  const redis = getRedis();
  if (!redis) return [];
  const ids = await redis.zrange<string[]>(ORDER_KEY, 0, limit - 1, { rev: true });
  if (ids.length === 0) return [];
  const entries = (await redis.hmget<Record<string, AdminLogEntry>>(ENTRIES_KEY, ...ids)) ?? {};
  return ids.map((id) => entries[id]).filter((entry): entry is AdminLogEntry => !!entry);
}

export async function getAction(id: string): Promise<{ entry: AdminLogEntry; snapshot: unknown } | null> {
  const redis = requireRedis();
  const [entry, snapshot] = await Promise.all([
    redis.hget<AdminLogEntry>(ENTRIES_KEY, id),
    redis.get<unknown>(snapshotKey(id)),
  ]);
  if (!entry) return null;
  return { entry, snapshot };
}

export async function setActionStatus(
  entry: AdminLogEntry,
  status: AdminLogEntry["status"],
): Promise<AdminLogEntry> {
  const redis = requireRedis();
  const next: AdminLogEntry = { ...entry, status, changedAt: new Date().toISOString() };
  await redis.hset(ENTRIES_KEY, { [entry.id]: next });
  return next;
}
