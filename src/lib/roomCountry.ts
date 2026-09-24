import { getRedis } from "./redis";

const countryKey = (roomId: string) => `waiting-room:rooms:country:${roomId}`;

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && COUNTRY_CODE_PATTERN.test(value);
}

/** Records which country an identity joined from — set once, at join time,
 * from Vercel's own IP-geolocation header (unavailable in local dev, so
 * callers just skip this when there's nothing to record). */
export async function setParticipantCountry(
  roomId: string,
  identity: string,
  countryCode: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.hset(countryKey(roomId), { [identity]: countryCode });
}

/** Clears this identity's recorded country — called when they stop
 * waiting, so a country's presence on the map/list reflects who's
 * currently here, not everyone who ever passed through. */
export async function clearParticipantCountry(roomId: string, identity: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.hdel(countryKey(roomId), identity);
}

export type CountryBreakdown = { code: string; count: number; percent: number };

/** Distinct countries currently represented in the room, most participants
 * first. */
export async function getCountryBreakdown(roomId: string): Promise<CountryBreakdown[]> {
  const redis = getRedis();
  if (!redis) return [];
  const raw = (await redis.hgetall<Record<string, string>>(countryKey(roomId))) ?? {};

  const counts = new Map<string, number>();
  let total = 0;
  for (const code of Object.values(raw)) {
    if (!isCountryCode(code)) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
    total += 1;
  }

  const breakdown = Array.from(counts.entries()).map(([code, count]) => ({
    code,
    count,
    percent: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
  // Tied counts need a deterministic tiebreaker — Redis doesn't guarantee
  // hash iteration order stays the same between reads, so without one, two
  // countries tied at the same count could swap places on every poll purely
  // from HGETALL happening to return them in a different order that time,
  // not from anything actually changing.
  breakdown.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  return breakdown;
}
