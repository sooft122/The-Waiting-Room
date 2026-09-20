"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Room } from "@/lib/rooms";
import ModalShell from "./ModalShell";

type DeleteRoomModalProps = {
  room: Room;
  onClose: () => void;
};

export default function DeleteRoomModal({ room, onClose }: DeleteRoomModalProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setDeleting(false);
        return;
      }
      router.push("/rooms");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setDeleting(false);
    }
  }

  return (
    <ModalShell onClose={onClose} labelledBy="delete-room-title">
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
        <div className="flex size-11 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="size-5" src="/icons/delete-02.svg" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 id="delete-room-title" className="font-satoshi text-[18px] text-white">
            Delete “{room.name}”?
          </h2>
          <p className="font-inter text-[13px] text-white/60">
            This permanently removes the room for everyone waiting in it, including{" "}
            {room.participantCount.toLocaleString()} joined participant
            {room.participantCount === 1 ? "" : "s"}. This can’t be undone.
          </p>
        </div>

        {error ? <p className="font-inter text-[12px] text-red-400">{error}</p> : null}

        <div className="flex w-full items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 flex-1 rounded-[8px] border border-[#2b2d30] font-satoshi text-[12px] text-white transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="h-9 flex-1 rounded-[8px] bg-red-500 font-satoshi text-[12px] font-medium text-white transition-colors hover:bg-red-400 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete Room"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
