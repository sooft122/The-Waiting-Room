import { getCheckinCounts } from "./roomPresence";
import { getVoterCount } from "./roomMood";
import { getChatCounts } from "./roomChat";

// Mood participation is a small, flat, one-time signal — each distinct
// voter adds a fixed sliver, once (re-voting changes the mood but not the
// voter count, which is a set keyed by identity, so nobody can inflate this
// by reselecting).
const MOOD_RATE_PER_VOTE = 0.5;

// Checking in is the main, repeatable lever — a fixed sliver per check-in,
// but capped per identity so no single person can keep pushing the number
// up alone. After their first CHECKIN_CAP check-ins, further checking in by
// that same person adds nothing more; growth past that point requires other
// people to check in.
const CHECKIN_RATE_PER_CHECKIN = 0.2;
const CHECKIN_CAP_PER_PERSON = 3;

// Chatting is a small, ongoing nudge rather than a weighted share like the
// two above — each counted message adds a fixed sliver, capped per identity
// so one person alone can't carry it (the 10s send cooldown already limits
// how fast that solo total can climb; this stops it from mattering even if
// they kept it up indefinitely).
const CHAT_RATE_PER_MESSAGE = 0.03;
const CHAT_CAP_PER_PERSON = 50;

/**
 * Room Energy (0-100), built entirely from data this app actually tracks —
 * the Figma design showed a meter with no defined source for its number.
 * Every signal is a flat rate per action (not a share of participants), so
 * the meaning of a single vote/check-in/message never changes as the room
 * grows or shrinks:
 *
 *  - moodContribution: distinct mood voters * MOOD_RATE_PER_VOTE
 *  - checkinContribution: (sum of each identity's check-ins, each capped at
 *    CHECKIN_CAP_PER_PERSON) * CHECKIN_RATE_PER_CHECKIN
 *  - chatContribution: (sum of each identity's messages, each capped at
 *    CHAT_CAP_PER_PERSON) * CHAT_RATE_PER_MESSAGE
 */
export async function getRoomEnergy(roomId: string, participantCount: number): Promise<number> {
  if (participantCount <= 0) return 0;

  const [voterCount, checkinCounts, chatCounts] = await Promise.all([
    getVoterCount(roomId),
    getCheckinCounts(roomId),
    getChatCounts(roomId),
  ]);

  const moodContribution = voterCount * MOOD_RATE_PER_VOTE;

  const cappedCheckinSum = Object.values(checkinCounts).reduce(
    (sum, count) => sum + Math.min(count, CHECKIN_CAP_PER_PERSON),
    0,
  );
  const checkinContribution = cappedCheckinSum * CHECKIN_RATE_PER_CHECKIN;

  const cappedChatSum = Object.values(chatCounts).reduce(
    (sum, count) => sum + Math.min(count, CHAT_CAP_PER_PERSON),
    0,
  );
  const chatContribution = cappedChatSum * CHAT_RATE_PER_MESSAGE;

  return Math.min(100, Math.round(moodContribution + checkinContribution + chatContribution));
}
