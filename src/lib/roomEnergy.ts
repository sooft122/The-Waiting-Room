import { getRecentPresenceCount } from "./roomPresence";
import { getVoterCount } from "./roomMood";

/**
 * Room Energy (0-100) blends two real engagement signals, equally weighted:
 *  - presence: share of participants who've checked in (joined, or tapped
 *    "I'm Still Here") within the last PRESENCE_WINDOW_MS
 *  - mood participation: share of participants who've cast a mood vote
 * The Figma design shows a "Room Energy" meter with no defined source for
 * its number — this formula is ours, built from data actually tracked by
 * the app rather than left random or hardcoded.
 */
export async function getRoomEnergy(roomId: string, participantCount: number): Promise<number> {
  if (participantCount <= 0) return 0;

  const [presentCount, voterCount] = await Promise.all([
    getRecentPresenceCount(roomId),
    getVoterCount(roomId),
  ]);

  const presenceRatio = Math.min(presentCount / participantCount, 1);
  const moodRatio = Math.min(voterCount / participantCount, 1);

  return Math.round(((presenceRatio + moodRatio) / 2) * 100);
}
