import type { RoomCategory } from "./rooms";

/**
 * Free, instant room descriptions stitched together from hand-written
 * pieces — no AI call, no API key. Used for "Generate using AI" whenever the
 * Claude API isn't configured (or a request to it fails), so the button
 * always produces something. Each piece reads fine next to any other, and
 * pressing the button again picks a different combination.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// {name} is the room name, {date} a formatted date like "Wednesday, 28 October".
const OPENERS_WITH_DATE = [
  "{name} lands on {date}, and the countdown is already on.",
  "Mark {date}: {name} is almost here.",
  "The wait for {name} ends on {date}.",
];
const OPENERS = [
  "The countdown to {name} is on.",
  "{name} is almost here.",
  "Everyone's counting down to {name}.",
];

const CATEGORY_LINES: Record<RoomCategory, string[]> = {
  Sports: [
    "Big games deserve a big crowd, and this one is filling up fast.",
    "Bring your nerves and your predictions. Fans everywhere are in.",
  ],
  Entertainment: [
    "The lights, the reveal, the first reactions: you'll want to be here for all of it.",
    "Settle in with fans who've been waiting just as long as you have.",
  ],
  Gaming: [
    "Squad up with players watching the same clock.",
    "Controllers charged, snacks stocked, clock ticking.",
  ],
  Technology: [
    "Every leak, rumour and guess ends here.",
    "Get ready for the big reveal with everyone refreshing the same page.",
  ],
  Culture: [
    "It's more than an event. It's a moment people plan their year around.",
    "Bring the energy and celebrate with people who get it.",
  ],
  Events: [
    "Save the date, then wait it out with everyone else who has.",
    "Plans are set and the excitement is building.",
  ],
  Other: [
    "Whatever it is, it's better with company.",
    "The clock is ticking, and you're not waiting alone.",
  ],
};

const CLOSERS = [
  "Join the wait and be here the second it happens.",
  "Join the room, share your mood and watch the clock hit zero together.",
  "Join the wait and count down with everyone else.",
  "Pull up a seat. We'll count down together.",
];

const MAX_LENGTH = 400;

/** "Wednesday, 28 October", plus the year when it isn't the current one.
 * Parsed by hand rather than through Date's string parsing, so the day
 * never shifts with the server's timezone. Null for anything malformed. */
function formatEventDate(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  const label = `${WEEKDAYS[utc.getUTCDay()]}, ${day} ${MONTHS[month - 1]}`;
  return year === new Date().getUTCFullYear() ? label : `${label} ${year}`;
}

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

// Rejects combinations that lean on the same phrase twice ("countdown ...
// count down", "clock ... clock"), which reads clumsy in three sentences.
function repeatsItself(text: string): boolean {
  const count = (pattern: RegExp) => (text.match(pattern) ?? []).length;
  return count(/clock/gi) > 1 || count(/count(ing)? ?down/gi) > 1;
}

export function generateTemplateDescription({
  name,
  category,
  date,
  previous,
}: {
  name: string;
  category?: string | null;
  /** ISO yyyy-mm-dd, as stored on the room. */
  date?: string | null;
  /** The description currently in the field, so a re-roll comes out different. */
  previous?: string | null;
}): string {
  const formattedDate = date ? formatEventDate(date) : null;
  const categoryLines =
    category && category in CATEGORY_LINES
      ? CATEGORY_LINES[category as RoomCategory]
      : CATEGORY_LINES.Other;

  let result = "";
  for (let attempt = 0; attempt < 30; attempt++) {
    // One pass with a replacer function, so a room name containing "$&" or
    // "{date}" is inserted literally rather than interpreted.
    const opener = pick(formattedDate ? [...OPENERS_WITH_DATE, ...OPENERS] : OPENERS).replace(
      /\{(name|date)\}/g,
      (_, key: string) => (key === "name" ? name : formattedDate ?? ""),
    );
    const middle = pick(categoryLines);
    const closer = pick(CLOSERS);
    let candidate = `${opener} ${middle} ${closer}`;
    // A very long room name can push three sentences past the limit — the
    // category line is the one to lose.
    if (candidate.length > MAX_LENGTH) candidate = `${opener} ${closer}`;
    result = candidate;
    if (!repeatsItself(candidate) && candidate !== previous?.trim()) break;
  }
  return result.slice(0, MAX_LENGTH);
}
