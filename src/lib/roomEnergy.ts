import { getCheckinCounts } from "./roomPresence";
import { getVoterCount } from "./roomMood";

// Mood participation is a small, one-time signal — voting (or re-voting,
// which doesn't add anything: distinct voters only counts each identity
// once) contributes up to this many points, shrinking per-person as the
// room grows since it's a share of participantCount.
const MOOD_WEIGHT = 30;

// Checking in is the main, repeatable lever — but capped per identity so
// no single person can keep pushing the number up alone. After their first
// CHECKIN_CAP check-ins, further checking in by that same person adds
// nothing more; growth past that point requires other people to check in.
const CHECKIN_WEIGHT = 70;
const CHECKIN_CAP_PER_PERSON = 3;

/**
 * Room Energy (0-100), built entirely from data this app actually tracks —
 * the Figma design showed a meter with no defined source for its number.
 *
 *  - moodContribution: (distinct mood voters / participants) * MOOD_WEIGHT
 *  - checkinContribution: (sum of each identity's check-ins, each capped at
 *    CHECKIN_CAP_PER_PERSON) / (participants * CHECKIN_CAP_PER_PERSON) * CHECKIN_WEIGHT
 */
export async function getRoomEnergy(roomId: string, participantCount: number): Promise<number> {
  if (participantCount <= 0) return 0;

  const [voterCount, checkinCounts] = await Promise.all([
    getVoterCount(roomId),
    getCheckinCounts(roomId),
  ]);

  const moodContribution = Math.round(Math.min(voterCount / participantCount, 1) * MOOD_WEIGHT);

  const cappedCheckinSum = Object.values(checkinCounts).reduce(
    (sum, count) => sum + Math.min(count, CHECKIN_CAP_PER_PERSON),
    0,
  );
  const maxPossibleCheckinSum = participantCount * CHECKIN_CAP_PER_PERSON;
  const checkinContribution =
    maxPossibleCheckinSum > 0
      ? Math.round(Math.min(cappedCheckinSum / maxPossibleCheckinSum, 1) * CHECKIN_WEIGHT)
      : 0;

  return Math.min(100, moodContribution + checkinContribution);
}
