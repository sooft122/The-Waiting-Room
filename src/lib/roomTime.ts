// Pure date/time helpers for a room's end moment — kept dependency-free (no
// Redis import, unlike lib/rooms.ts) so client components (the create/edit
// room modals) can import this directly without pulling server-only code
// into the browser bundle. Same reasoning as roomPresenceConstants.ts.

export type RoomDateTime = { date: string; time: string | null };

const ROOM_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Validates the optional 24h "HH:mm" time field from a create/edit room
 * request: blank/missing means "no time set" (the room falls back to UTC
 * midnight — see getRoomEndTime below — unchanged from before this field
 * existed); anything present must be well-formed. */
export function parseRoomTime(value: unknown): { ok: true; time: string | null } | { ok: false } {
  if (value === undefined || value === null || value === "") return { ok: true, time: null };
  if (typeof value === "string" && ROOM_TIME_PATTERN.test(value)) return { ok: true, time: value };
  return { ok: false };
}

/** The exact moment a room's wait ends, combining `date` with the optional
 * `time` — anchored to UTC so it's the same instant for every viewer
 * regardless of their own timezone, same as a plain "yyyy-mm-dd" date
 * already parses as UTC midnight. Falls back to UTC midnight when no time
 * is set (including rooms created before this field existed), so those
 * behave exactly as they did before. */
export function getRoomEndTime(room: RoomDateTime): Date {
  return new Date(`${room.date}T${room.time || "00:00"}:00.000Z`);
}
