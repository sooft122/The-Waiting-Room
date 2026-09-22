"use client";

import { useState } from "react";
import Link from "next/link";
import type { Room } from "@/lib/rooms";
import type { RoomSectionSlug } from "@/lib/roomSections";
import { useStaggerEntrance } from "@/hooks/useStaggerEntrance";
import RoomCard from "./RoomCard";

type RoomSectionRowProps = {
  title: string;
  /** When set, "View all" navigates to the dedicated /rooms/all/<slug> page
   * instead of expanding in place — only sections with a matching entry in
   * ROOM_SECTIONS (the Discover Rooms sections) have one. Callers without a
   * slug (e.g. Archive's Ongoing/Ended) fall back to expanding inline. */
  slug?: RoomSectionSlug;
  rooms: Room[];
  emptyMessage: string;
  /** Room ids the current viewer has joined, for the "Joined" badge. */
  joinedRoomIds?: Set<string>;
};

export default function RoomSectionRow({
  title,
  slug,
  rooms,
  emptyMessage,
  joinedRoomIds,
}: RoomSectionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = rooms.length > 4;
  const visibleRooms = !slug && expanded ? rooms : rooms.slice(0, 4);

  // Capped at 8 steps so a long row still finishes settling quickly —
  // cards past the cap fade in alongside the last staggered one instead of
  // visibly trickling in one-by-one.
  const entrance = useStaggerEntrance(60, 45, 8);
  const headerEntrance = entrance();
  const cardEntrances = visibleRooms.map(() => entrance());

  return (
    <section className="w-full">
      <div className={`flex items-center justify-between ${headerEntrance.className}`} style={headerEntrance.style}>
        <h2 className="font-satoshi text-[16px] text-white">{title}</h2>
        {canExpand ? (
          slug ? (
            <Link
              href={`/rooms/all/${slug}`}
              className="flex items-center gap-1 font-satoshi text-[12px] text-white/60 hover:text-white"
            >
              <span>View all {rooms.length}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="size-3.5" src="/icons/arrow-right-02.svg" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="flex items-center gap-1 font-satoshi text-[12px] text-white/60 hover:text-white"
            >
              <span>{expanded ? "Show less" : `View all ${rooms.length}`}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className={`size-3.5 transition-transform ${expanded ? "-rotate-90" : ""}`}
                src="/icons/arrow-right-02.svg"
              />
            </button>
          )
        ) : null}
      </div>

      <div className="mt-3.5">
        {visibleRooms.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {visibleRooms.map((room, i) => (
              <div key={room.id} className={cardEntrances[i].className} style={cardEntrances[i].style}>
                <RoomCard room={room} joined={joinedRoomIds?.has(room.id) ?? false} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[100px] items-center justify-center rounded-[20px] bg-white/[0.02] px-6 text-center">
            <p className="font-inter text-[13px] text-white/40">{emptyMessage}</p>
          </div>
        )}
      </div>
    </section>
  );
}
