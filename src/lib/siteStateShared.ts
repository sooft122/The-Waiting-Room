// The site-wide state the admin dashboard controls — shared by the server
// (siteState.ts) and every open page (SiteStateProvider), so no Redis import
// here, same reasoning as roomPresenceConstants.ts.

export type RoomCreationSetting = {
  /** When true, nobody can create a room (the admin still can, from the dashboard). */
  locked: boolean;
  /** Shown to people who try while it's locked — null uses the default below. */
  message: string | null;
};

export type SiteState = {
  /** Goes up whenever the admin changes rooms — open pages re-fetch their data when it moves. */
  contentVersion: number;
  /** Goes up whenever the admin changes someone's account (name, photo, suspension) —
   * open pages re-read the viewer's own profile when it moves. */
  peopleVersion: number;
  roomCreation: RoomCreationSetting;
};

export const DEFAULT_SITE_STATE: SiteState = {
  contentVersion: 0,
  peopleVersion: 0,
  roomCreation: { locked: false, message: null },
};

export const ROOM_CREATION_LOCKED_MESSAGE =
  "Creating new rooms is paused for now. Please check back a little later.";

export const MAX_LOCK_MESSAGE_LENGTH = 160;

/** How often open pages check for admin changes while they're visible. */
export const SITE_STATE_POLL_MS = 4000;
