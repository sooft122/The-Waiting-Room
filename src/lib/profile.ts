import { getRedis } from "./redis";

export type Profile = {
  identity: string;
  /** Override name; null means "use the account default". */
  displayName: string | null;
  /** Override avatar (data URI); null means "use the default avatar". */
  avatarUrl: string | null;
  joinedAt: string;
  isAnonymous: boolean;
};

const profileKey = (identity: string) => `waiting-room:users:${identity}`;

/**
 * Race-safe get-or-create: the SETNX-style write only lands if the record
 * doesn't already exist, so a visitor's real `joinedAt` is never clobbered
 * by a second concurrent request.
 */
export async function getOrCreateProfile(
  identity: string,
  isAnonymous: boolean,
): Promise<Profile> {
  const fallback: Profile = {
    identity,
    displayName: null,
    avatarUrl: null,
    joinedAt: new Date().toISOString(),
    isAnonymous,
  };

  const redis = getRedis();
  if (!redis) return fallback;

  // Read first: the common case (a returning visitor) resolves in a single
  // round trip. The write-then-read fallback only runs the one time a
  // profile doesn't exist yet.
  const key = profileKey(identity);
  const existing = await redis.get<Profile>(key);
  if (existing) return existing;

  await redis.set(key, fallback, { nx: true });
  const profile = await redis.get<Profile>(key);
  return profile ?? fallback;
}

export async function updateProfile(
  identity: string,
  updates: Partial<Pick<Profile, "displayName" | "avatarUrl">>,
): Promise<Profile> {
  const redis = getRedis();
  if (!redis) throw new Error("Profile storage is not configured.");

  const existing = await getOrCreateProfile(identity, identity.startsWith("anon:"));
  const next: Profile = { ...existing, ...updates };
  await redis.set(profileKey(identity), next);
  return next;
}
