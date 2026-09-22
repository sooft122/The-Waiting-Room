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

/** "Starting Soon" and "Mostly Crowded" need signals we don't track yet (a
 * soon-to-start window, live participant counts) — deliberately left empty
 * rather than faked, same policy as the homepage sections they mirror. */
export function getSectionRooms(rooms: Room[], slug: RoomSectionSlug): Room[] {
  if (slug === "recently-created") return rooms;
  return [];
}
