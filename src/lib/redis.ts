import { Redis } from "@upstash/redis";

let client: Redis | null | undefined;

/** Lazily-created shared Redis client. Returns null if the env vars aren't set.
 * Checks the vars ourselves first — Redis.fromEnv() doesn't validate the URL
 * up front, so an empty/missing value doesn't throw until the first real
 * command runs (e.g. during static page generation), which is too late to
 * catch here and crashes the build instead of degrading gracefully. */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    client = null;
    return client;
  }

  try {
    client = new Redis({ url, token });
  } catch {
    client = null;
  }
  return client;
}
