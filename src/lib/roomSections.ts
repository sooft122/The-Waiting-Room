import { getRoomEndTime, isRoomActive, isRoomStartingSoon } from "./rooms";
import type { Room } from "./rooms";

export type RoomSectionSlug = "recently-created" | "starting-soon" | "mostly-crowded";

type RoomSectionMeta = {
  slug: RoomSectionSlug;
  title: string;
  emptyMessage: string;
};

export const ROOM_SECTIONS: readonly RoomSectionMeta[] = [
  {
    slug: "recently-created",
    title: "Recently Created",
    emptyMessage: "No rooms yet — be the first to create one.",
  },
  {
    slug: "starting-soon",
    title: "Starting Soon",
    emptyMessage: "Nothing starting soon yet.",
  },
  {
    slug: "mostly-crowded",
    title: "Mostly Crowded",
    emptyMessage: "Nothing crowded yet.",
  },
];

export function getRoomSection(slug: string): RoomSectionMeta | null {
  return ROOM_SECTIONS.find((section) => section.slug === slug) ?? null;
}

/** "Mostly Crowded" needs a signal we don't track yet (live participant
 * counts relative to some baseline) — deliberately left empty rather than
 * faked, same policy as the homepage section it mirrors.
 * "Recently Created" excludes ended rooms — this is a discovery surface for
 * rooms you can still join and wait in, not an archive of past ones.
 * "Starting Soon" is any active room with under 24 hours left on its
 * countdown, soonest first — the room's date is when the awaited thing
 * happens, so a countdown that low means it's about to start. */
export function getSectionRooms(rooms: Room[], slug: RoomSectionSlug): Room[] {
  if (slug === "recently-created") return rooms.filter(isRoomActive);
  if (slug === "starting-soon") {
    return rooms
      .filter(isRoomStartingSoon)
      .sort((a, b) => getRoomEndTime(a).getTime() - getRoomEndTime(b).getTime());
  }
  return [];
}
