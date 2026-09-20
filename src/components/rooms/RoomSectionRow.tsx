"use client";

import { useState } from "react";
import type { Room } from "@/lib/rooms";
import RoomCard from "./RoomCard";

type RoomSectionRowProps = {
  title: string;
  rooms: Room[];
  emptyMessage: string;
  /** Room ids the current viewer has joined, for the "Joined" badge. */
  joinedRoomIds?: Set<string>;
};

export default function RoomSectionRow({
  title,
  rooms,
  emptyMessage,
  joinedRoomIds,
}: RoomSectionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = rooms.length > 4;
  const visibleRooms = expanded ? rooms : rooms.slice(0, 4);

  return (
    <section className="w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-satoshi text-[16px] text-white">{title}</h2>
        {rooms.length > 0 ? (
          <button
            type="button"
            onClick={() => canExpand && setExpanded((current) => !current)}
            disabled={!canExpand}
            className="flex items-center gap-1 font-satoshi text-[12px] text-white/60 disabled:cursor-default enabled:hover:text-white"
          >
            <span>{expanded ? "Show less" : `View all ${rooms.length}`}</span>
            {canExpand ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className={`size-3.5 transition-transform ${expanded ? "-rotate-90" : ""}`}
                src="/icons/arrow-right-02.svg"
              />
            ) : null}
          </button>
        ) : null}
      </div>

      <div className="mt-3.5">
        {visibleRooms.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {visibleRooms.map((room) => (
              <RoomCard key={room.id} room={room} joined={joinedRoomIds?.has(room.id) ?? false} />
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
