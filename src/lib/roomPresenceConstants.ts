// Shared between server (src/lib/roomPresence.ts) and client components —
// kept in its own module (no Redis import) so client bundles never pull in
// server-only code just to read these two numbers.

// A participant counts as "currently present" if they've checked in (joined,
// or hit "I'm Still Here") within this window. Used for the Lobby's own
// display and as one of the two real signals behind Room Energy.
export const PRESENCE_WINDOW_MS = 15 * 60 * 1000;

// "I'm Still Here" can only be pressed once per hour per identity, so it
// can't be spammed to inflate Room Energy.
export const CHECK_IN_COOLDOWN_MS = 60 * 60 * 1000;
