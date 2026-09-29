import { getRedis } from "./redis";
import { SUSPENDED_IDENTITIES_KEY } from "./suspensionShared";

export { SUSPENDED_MESSAGE } from "./suspensionShared";

/** Whether any of these identities is suspended — a signed-in visitor is
 * checked under both their account and the Anonymous number their browser
 * still carries, so signing in or out doesn't slip a suspension. The actual
 * blocking happens in the middleware; this is for showing the notice. */
export async function isAnySuspended(identities: string[]): Promise<boolean> {
  const redis = getRedis();
  if (!redis || identities.length === 0) return false;
  try {
    const flags = await redis.smismember(SUSPENDED_IDENTITIES_KEY, identities);
    return flags.some((flag) => flag === 1);
  } catch {
    return false;
  }
}

export async function getSuspendedIdentities(): Promise<Set<string>> {
  const redis = getRedis();
  if (!redis) return new Set();
  const members = await redis.smembers(SUSPENDED_IDENTITIES_KEY);
  return new Set(members);
}

export async function setSuspended(identity: string, suspended: boolean): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Storage is not configured.");
  if (suspended) await redis.sadd(SUSPENDED_IDENTITIES_KEY, identity);
  else await redis.srem(SUSPENDED_IDENTITIES_KEY, identity);
}
