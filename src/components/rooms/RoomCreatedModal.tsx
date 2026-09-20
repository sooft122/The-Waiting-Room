"use client";

import { useState } from "react";
import Link from "next/link";
import type { Room } from "@/lib/rooms";
import ModalShell from "./ModalShell";

type RoomCreatedModalProps = {
  room: Room;
  onClose: () => void;
};

export default function RoomCreatedModal({ room, onClose }: RoomCreatedModalProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/rooms/${room.id}` : "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the link is still visible in the field to copy manually.
    }
  }

  return (
    <ModalShell onClose={onClose} labelledBy="room-created-title">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 size-5 cursor-pointer"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="block size-full" src="/icons/cancel-01.svg" />
      </button>

      <div className="flex flex-col items-start gap-5">
        <h2 id="room-created-title" className="font-satoshi text-[18px] text-white">
          Room Created!
        </h2>

        <div className="flex w-full flex-col gap-3.5">
          <div className="relative h-[274px] w-full overflow-hidden rounded-[20px] border border-[rgba(227,221,221,0.4)] bg-[#101113]">
            <div className="absolute left-0 top-0 h-[207px] w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                src={room.imageUrl}
                className="absolute inset-0 size-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(to bottom, rgba(0,0,0,0) 8.937%, #101113 92.271%)",
                }}
              />
              <div className="absolute bottom-5 left-5 flex w-[calc(100%-40px)] flex-col gap-1 font-satoshi text-white">
                <p className="truncate text-[16px]">{room.name}</p>
                <p className="text-[14px] opacity-65">{room.date}</p>
              </div>
            </div>
            <p className="absolute left-5 top-[235px] font-satoshi text-[14px] text-white opacity-65">
              Room has been created
            </p>
          </div>

          <div className="flex w-full items-start gap-1.5">
            <div className="h-9 flex-1 overflow-hidden rounded-[8px] border border-[#2b2d30] bg-[#1b1c21]">
              <p className="flex h-full items-center truncate px-2.5 font-satoshi text-[12px] text-white/50">
                {shareUrl}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-9 w-[111px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] p-px drop-shadow-[0px_2px_2.7px_rgba(0,0,0,0.05)]"
            >
              <span
                className="flex h-full w-full items-center justify-center gap-1.5 rounded-[6px] shadow-[0px_4px_27px_0px_rgba(0,0,0,0.18)]"
                style={{ backgroundImage: "linear-gradient(180deg, #252628, #18191b)" }}
              >
                <span className="font-figtree text-[12px] font-medium text-subtle">
                  {copied ? "Copied!" : "Copy Link"}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="size-3.5" src="/icons/copy-01.svg" />
              </span>
            </button>
          </div>
        </div>

        <Link href={`/rooms/${room.id}`} onClick={onClose} className="block w-full">
          <span className="relative flex w-full flex-col items-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)]">
            <span className="relative flex w-full items-center justify-center overflow-hidden rounded-[9px] px-[30px] py-2">
              <span
                aria-hidden
                className="absolute inset-0 rounded-[9px]"
                style={{
                  backgroundImage:
                    "linear-gradient(180.22deg, rgb(228,221,221) 19.37%, rgb(220,220,220) 40.857%, rgb(216,213,213) 65.087%, rgb(209,209,209) 97.546%)",
                }}
              />
              <span className="relative font-figtree text-[12px] font-medium text-black">
                Check Out The Room
              </span>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(28,28,28,0.05)]"
              />
            </span>
          </span>
        </Link>
      </div>
    </ModalShell>
  );
}
