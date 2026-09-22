"use client";

import Link from "next/link";
import type { Room } from "@/lib/rooms";
import { useCountdown } from "@/hooks/useCountdown";
import { CountdownRow } from "./CountdownUnits";

type RoomCardProps = {
  room: Room;
  joined?: boolean;
};

export default function RoomCard({ room, joined = false }: RoomCardProps) {
  const countdown = useCountdown(room.date);
  const hasEnded = countdown === null;

  return (
    <Link
      href={`/rooms/${room.id}`}
      className="room-card-glow group relative block h-[290px] w-full max-w-[296px] overflow-hidden rounded-[20px] border border-transparent bg-[#101113] transition-colors hover:border-[rgba(227,221,221,0.25)]"
    >
      <div className="absolute left-0 top-0 h-[207px] w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={room.imageUrl} className="absolute inset-0 size-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(0,0,0,0) 8.937%, #101113 92.271%)",
          }}
        />
        <div className="absolute bottom-5 left-5 flex w-[calc(100%-40px)] flex-col gap-1 font-satoshi text-white">
          <p className="truncate text-[16px]">{room.name}</p>
          <p className="text-[14px] opacity-65">
            {room.participantCount.toLocaleString()} {hasEnded ? "waited" : "waiting"}
          </p>
        </div>
        {joined ? (
          <div
            className="absolute right-[10px] top-[10px] flex items-center rounded-[17px] px-2 py-[5px]"
            style={{ backgroundImage: "linear-gradient(180deg, #a8a8a8, #d3d3d3)" }}
          >
            <p className="font-satoshi text-[12px] text-black opacity-65">Joined</p>
          </div>
        ) : null}
      </div>

      {hasEnded ? (
        <p className="absolute left-5 top-[235px] font-satoshi text-[14px] text-white opacity-65">
          Wait Ended
        </p>
      ) : (
        <div className="absolute bottom-[13px] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 font-satoshi text-white">
          <CountdownRow countdown={countdown} />
          <p className="text-[14px] opacity-65">{room.date}</p>
        </div>
      )}
    </Link>
  );
}
