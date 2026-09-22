import { isRoomActive } from "./rooms";
import type { Room } from "./rooms";

// Below this, a name is too short/generic for similarity to mean anything
// ("Party" matching "Party" tells you nothing) — skip the check entirely.
const MIN_NAME_LENGTH = 3;

// How similar two names need to be (0-1) to count as "the same event,
// worded differently" — tuned down when the dates also match, since two
// different titles landing on the exact same date is itself a strong signal
// (e.g. "iPhone 17 Launch" vs "Apple iPhone 17 Event", both 2026-09-12).
const NAME_SIMILARITY_THRESHOLD = 0.68;
const NAME_SIMILARITY_THRESHOLD_SAME_DATE = 0.5;

// Filtered out before comparing word sets — otherwise two unrelated rooms
// that both happen to be a "Launch" or a "Concert" would look deceptively
// similar (e.g. "Taylor Swift Concert" vs "Ed Sheeran Concert" sharing only
// this one generic word shouldn't count as a match).
const GENERIC_EVENT_WORDS = new Set([
  "the", "a", "an", "of", "and", "for", "to", "in", "on", "at", "is",
  "day", "night", "week", "weekend", "party", "event", "celebration",
  "release", "launch", "premiere", "concert", "show", "festival",
  "date", "edition", "annual", "official", "grand", "special", "live",
]);

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Standard edit distance — counts single-character insertions, deletions,
 * and substitutions needed to turn one string into the other. */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  const currentRow = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    currentRow[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(
        currentRow[j - 1] + 1,
        previousRow[j] + 1,
        previousRow[j - 1] + cost,
      );
    }
    previousRow = [...currentRow];
  }

  return previousRow[b.length];
}

/** 1 - normalized edit distance: 1 for identical strings, trending to 0 the
 * more characters need to change to turn one into the other. */
function characterSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLength;
}

function significantWords(normalized: string): string[] {
  return normalized.split(" ").filter((word) => word && !GENERIC_EVENT_WORDS.has(word));
}

/** Jaccard similarity of the two names' significant-word sets (generic
 * words filtered out first) — catches cases edit distance misses, like
 * reordered or padded titles ("Launch Party: iPhone 17" vs "iPhone 17
 * Launch Party"), while ignoring shared words too generic to mean anything. */
function wordOverlapSimilarity(a: string, b: string): number {
  const wordsA = Array.from(new Set(significantWords(a)));
  const wordsB = new Set(significantWords(b));
  if (wordsA.length === 0 || wordsB.size === 0) return 0;

  let shared = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) shared += 1;
  }
  const unionSize = wordsA.length + wordsB.size - shared;
  return unionSize === 0 ? 0 : shared / unionSize;
}

/** Best-effort similarity between two room names (0-1), taking whichever of
 * the character-level or word-level signal is stronger. */
function nameSimilarity(a: string, b: string): number {
  const normalizedA = normalize(a);
  const normalizedB = normalize(b);
  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;
  return Math.max(
    characterSimilarity(normalizedA, normalizedB),
    wordOverlapSimilarity(normalizedA, normalizedB),
  );
}

export type DuplicateMatch = {
  room: Room;
  similarity: number;
  sameDate: boolean;
};

/**
 * Finds existing (still-active) rooms whose name looks like it might
 * describe the same event as `name` — a near-identical title on its own,
 * or a looser match reinforced by landing on the exact same date. Meant to
 * flag likely duplicates, not block them: titles are free text, and two
 * genuinely different events can still land on similar wording.
 */
export function findLikelyDuplicates(
  name: string,
  date: string | null,
  candidates: Room[],
  excludeRoomId?: string,
): DuplicateMatch[] {
  const trimmed = name.trim();
  if (trimmed.length < MIN_NAME_LENGTH) return [];

  const matches: DuplicateMatch[] = [];
  for (const room of candidates) {
    if (room.id === excludeRoomId) continue;
    if (!isRoomActive(room)) continue;

    const sameDate = !!date && room.date === date;
    const similarity = nameSimilarity(trimmed, room.name);
    const threshold = sameDate ? NAME_SIMILARITY_THRESHOLD_SAME_DATE : NAME_SIMILARITY_THRESHOLD;
    if (similarity >= threshold) {
      matches.push({ room, similarity, sameDate });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}
