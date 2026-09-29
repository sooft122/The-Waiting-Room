"use client";

import ModalShell from "./ModalShell";
import { ROOM_CREATION_LOCKED_MESSAGE } from "@/lib/siteStateShared";

type RoomCreationLockedModalProps = {
  message: string | null;
  /** True when the create form was already open when creation got locked. */
  interrupted: boolean;
  onClose: () => void;
};

/** Shown instead of the Create Room form while the admin has room creation locked. */
export default function RoomCreationLockedModal({ message, interrupted, onClose }: RoomCreationLockedModalProps) {
  return (
    <ModalShell onClose={onClose} labelledBy="room-creation-locked-title">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <span className="flex size-11 items-center justify-center rounded-full border border-border bg-[#1b1c21]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="size-5 invert" src="/icons/lock-01.svg" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 id="room-creation-locked-title" className="font-satoshi text-[18px] text-white">
            {interrupted ? "Room creation was just paused" : "Room creation is paused"}
          </h2>
          <p className="mx-auto max-w-[320px] font-inter text-[13px] leading-[1.5] text-white/60">
            {message ?? ROOM_CREATION_LOCKED_MESSAGE}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-1 h-9 w-full max-w-[200px] rounded-[10px] border border-border bg-[#1b1c21] font-figtree text-[12px] font-medium text-white transition-colors hover:bg-[#232429]"
        >
          Okay
        </button>
      </div>
    </ModalShell>
  );
}
