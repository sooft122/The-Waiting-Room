import { getRedis } from "./redis";

export const MOOD_OPTIONS = ["Hype", "Nervous", "Tired", "Curious", "Just Here"] as const;
export type Mood = (typeof MOOD_OPTIONS)[number];

export function isMood(value: unknown): value is Mood {
  return typeof value === "string" && (MOOD_OPTIONS as readonly string[]).includes(value);
}

export type MoodBreakdown = { mood: Mood; count: number; percent: number };

const moodKey = (roomId: string) => `waiting-room:rooms:mood:${roomId}`;

/** One vote per identity per room — casting again overwrites the previous pick. */
export async function castMoodVote(roomId: string, identity: string, mood: Mood): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Room storage is not configured.");
  await redis.hset(moodKey(roomId), { [identity]: mood });
}

export async function getViewerMood(roomId: string, identity: string): Promise<Mood | null> {
  const redis = getRedis();
  if (!redis) return null;
  const value = await redis.hget<string>(moodKey(roomId), identity);
  return isMood(value) ? value : null;
}

/** Number of participants who have cast a mood vote in this room. */
export async function getVoterCount(roomId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  return redis.hlen(moodKey(roomId));
}

export async function getMoodBreakdown(
  roomId: string,
): Promise<{ breakdown: MoodBreakdown[]; totalVotes: number }> {
  const redis = getRedis();
  const votes = redis ? ((await redis.hgetall<Record<string, string>>(moodKey(roomId))) ?? {}) : {};

  const counts = new Map<Mood, number>(MOOD_OPTIONS.map((mood) => [mood, 0]));
  let totalVotes = 0;
  for (const value of Object.values(votes)) {
    if (isMood(value)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
      totalVotes += 1;
    }
  }

  const breakdown = MOOD_OPTIONS.map((mood) => {
    const count = counts.get(mood) ?? 0;
    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    return { mood, count, percent };
  });

  return { breakdown, totalVotes };
}
