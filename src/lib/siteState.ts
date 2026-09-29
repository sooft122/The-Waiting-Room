import { getRedis } from "./redis";
import {
  DEFAULT_SITE_STATE,
  MAX_LOCK_MESSAGE_LENGTH,
  type RoomCreationSetting,
  type SiteState,
} from "./siteStateShared";

export type { RoomCreationSetting, SiteState } from "./siteStateShared";

const CONTENT_VERSION_KEY = "waiting-room:site:content-version";
const PEOPLE_VERSION_KEY = "waiting-room:site:people-version";
const SETTINGS_KEY = "waiting-room:site:settings";

type StoredSettings = { roomCreation?: Partial<RoomCreationSetting> };

function toVersion(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function toRoomCreation(stored: StoredSettings | null): RoomCreationSetting {
  const raw = stored?.roomCreation;
  const message = typeof raw?.message === "string" && raw.message.trim() ? raw.message.trim() : null;
  return { locked: raw?.locked === true, message };
}

/** One round trip for everything an open page needs to stay in step with the
 * admin dashboard. Falls back to "nothing locked" if Redis is unreachable, so
 * an outage never locks anyone out of anything. */
export async function getSiteState(): Promise<SiteState> {
  const redis = getRedis();
  if (!redis) return DEFAULT_SITE_STATE;
  try {
    const [contentVersion, peopleVersion, settings] = await redis.mget<
      [unknown, unknown, StoredSettings | null]
    >(CONTENT_VERSION_KEY, PEOPLE_VERSION_KEY, SETTINGS_KEY);
    return {
      contentVersion: toVersion(contentVersion),
      peopleVersion: toVersion(peopleVersion),
      roomCreation: toRoomCreation(settings),
    };
  } catch {
    return DEFAULT_SITE_STATE;
  }
}

/** Tells every open page that rooms changed — each re-fetches its own data
 * on its next check (see SiteStateProvider). */
export async function bumpContentVersion(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.incr(CONTENT_VERSION_KEY);
}

/** Tells every open page that an account changed — each re-reads its own
 * viewer's profile (name, photo, suspension) on its next check. */
export async function bumpPeopleVersion(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.incr(PEOPLE_VERSION_KEY);
}

export async function getRoomCreationSetting(): Promise<RoomCreationSetting> {
  return (await getSiteState()).roomCreation;
}

export async function setRoomCreationSetting(setting: RoomCreationSetting): Promise<RoomCreationSetting> {
  const redis = getRedis();
  if (!redis) throw new Error("Site settings storage is not configured.");

  const message = setting.message?.trim().slice(0, MAX_LOCK_MESSAGE_LENGTH) || null;
  const next: RoomCreationSetting = { locked: setting.locked, message };
  const stored = (await redis.get<StoredSettings>(SETTINGS_KEY)) ?? {};
  await redis.set(SETTINGS_KEY, { ...stored, roomCreation: next });
  return next;
}
