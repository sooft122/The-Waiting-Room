import { Redis } from "@upstash/redis";

let client: Redis | null | undefined;

/** Lazily-created shared Redis client. Returns null if the env vars aren't set. */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  try {
    client = Redis.fromEnv();
  } catch {
    client = null;
  }
  return client;
}
