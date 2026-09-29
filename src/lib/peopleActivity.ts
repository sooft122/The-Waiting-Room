import { getRedis } from "./redis";

// Identity → when they last opened the site (ISO). Written each time the app
// loads their profile, so the admin dashboard can show "last active".
export const LAST_SEEN_KEY = "waiting-room:people:last-seen";
// Account email → the name and photo Google gave them at their last visit.
// Profiles only store someone's own overrides, so without this the dashboard
// would have nothing better than an email address to show for most people.
export const ACCOUNTS_KEY = "waiting-room:people:accounts";

export type AccountInfo = { name: string | null; image: string | null };

/** Never throws — this is bookkeeping for the admin dashboard, and must
 * never get in the way of the page it rides along with. */
export async function recordVisit(identity: string, account: AccountInfo | null): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const pipeline = redis.pipeline();
    pipeline.hset(LAST_SEEN_KEY, { [identity]: new Date().toISOString() });
    if (account) pipeline.hset(ACCOUNTS_KEY, { [identity]: account });
    await pipeline.exec();
  } catch {
    // Missing one visit's timestamp is harmless.
  }
}
