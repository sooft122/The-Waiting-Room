import type { AdminRoom } from "@/lib/admin/types";

export type RoomStatus = "active" | "soon" | "ended" | "trashed";

const DAY_MS = 24 * 60 * 60 * 1000;

export function roomStatus(room: AdminRoom, now: number): RoomStatus {
  if (room.trashedAt) return "trashed";
  const endsIn = Date.parse(room.endsAt) - now;
  if (!(endsIn > 0)) return "ended";
  return endsIn <= DAY_MS ? "soon" : "active";
}

export function isLive(room: AdminRoom, now: number): boolean {
  const status = roomStatus(room, now);
  return status === "active" || status === "soon";
}

/** "3d 4h", "5h 12m", "12m", "40s" */
export function formatSpan(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  if (days < 100) return `${days}d ${hours % 24}h`;
  return `${days}d`;
}

export function timeAgo(iso: string | null | undefined, now: number): string {
  if (!iso) return "—";
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  if (ms < 45_000) return "just now";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A room's end as it was set — "26 Sep 2026, 21:30" (UTC, like everywhere on the site). */
export function formatRoomEnd(room: Pick<AdminRoom, "date" | "time">): string {
  const [year, month, day] = room.date.split("-").map(Number);
  const label = year && month && day ? `${day} ${MONTHS[month - 1]} ${year}` : room.date;
  return room.time ? `${label}, ${room.time}` : label;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

/** A letter or digit in any script (cased scripts, digits, and CJK) —
 * leaves out emoji and punctuation. */
function isWordChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return char.toLowerCase() !== char.toUpperCase() || (code >= 48 && code <= 57) || (code >= 0x2e80 && code < 0xa000);
}

export function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith("Anonymous #")) return "#";
  const words = trimmed
    .split(/\s+/)
    .map((word) => Array.from(word).filter(isWordChar))
    .filter((chars) => chars.length > 0);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).join("").toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const AVATAR_TINTS = ["#6d7cff", "#b86bff", "#ff7aa8", "#ff9f5a", "#e6c34a", "#5fd08f", "#4cc7d8", "#8a93a6"];

export function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

export function roomImageUrl(room: Pick<AdminRoom, "id" | "imageVersion">): string {
  return `/api/admin/image?room=${encodeURIComponent(room.id)}&v=${room.imageVersion}`;
}

export const MOOD_EMOJI: Record<string, string> = {
  Hype: "🔥",
  Nervous: "😬",
  Tired: "😴",
  Curious: "🤔",
  "Just Here": "😌",
};
