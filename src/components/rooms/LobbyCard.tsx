"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useElapsed } from "@/hooks/useElapsed";
import { useCooldown } from "@/hooks/useCooldown";
import { CHECK_IN_COOLDOWN_MS, PRESENCE_WINDOW_MS } from "@/lib/roomPresenceConstants";
import LobbySwarm from "./LobbySwarm";

type LobbyCardProps = {
  roomId: string;
  participantCount: number;
  hasJoined: boolean;
  joinedAt: string | null;
  lastSeenAt: string | null;
  identity: string | null;
};

export default function LobbyCard({
  roomId,
  participantCount,
  hasJoined,
  joinedAt,
  lastSeenAt,
  identity,
}: LobbyCardProps) {
  const router = useRouter();
  const [checkingIn, setCheckingIn] = useState(false);
  const [localLastSeenAt, setLocalLastSeenAt] = useState(lastSeenAt);
  const elapsed = useElapsed(joinedAt);
  const cooldown = useCooldown(localLastSeenAt, CHECK_IN_COOLDOWN_MS);
  const presence = useCooldown(localLastSeenAt, PRESENCE_WINDOW_MS);
  const isGlowing = presence.active;

  async function handleCheckIn() {
    if (cooldown.active) return;
    setCheckingIn(true);
    try {
      const response = await fetch(`/api/rooms/${roomId}/presence`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (data.lastSeenAt) setLocalLastSeenAt(data.lastSeenAt);
      router.refresh();
    } finally {
      setCheckingIn(false);
    }
  }

  const stillHereLabel = checkingIn
    ? "Checking in…"
    : cooldown.active
      ? `Back in ${cooldown.remainingLabel}`
      : "I’m Still here";

  return (
    <div className="flex w-full flex-1 flex-col overflow-hidden rounded-[20px] bg-[#08090b]">
      <div className="flex h-auto min-h-[50px] w-full shrink-0 flex-wrap items-center justify-between gap-2 bg-[#101113] px-[17px] py-2 sm:h-[50px] sm:py-0">
        <h2 className="font-figtree text-[14px] text-white">The Lobby</h2>
        <div className="flex items-center gap-[11px] py-2 sm:py-0">
          {hasJoined && elapsed ? (
            <div className="flex items-center gap-[8px] rounded-[6px] bg-[#16171a] px-[12px] py-[6px]">
              <span
                className={`size-[5px] shrink-0 rounded-full bg-[#7cff8f] ${isGlowing ? "lobby-dot-me" : ""}`}
              />
              <span className="whitespace-nowrap font-figtree text-[12px] text-white opacity-70">
                You’ve been waiting . {elapsed}
              </span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleCheckIn}
            disabled={!hasJoined || checkingIn || cooldown.active}
            className="flex h-[32px] w-[113px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] p-px shadow-[0px_2px_2.7px_rgba(0,0,0,0.05)] disabled:cursor-default disabled:opacity-40"
          >
            <span
              className="flex size-full items-center justify-center rounded-[6px] shadow-[0px_4px_27px_0px_rgba(0,0,0,0.18)]"
              style={{ backgroundImage: "linear-gradient(180deg, #252628, #18191b)" }}
            >
              <span className="whitespace-nowrap font-figtree text-[11px] font-medium text-[#b8b8b8]">
                {stillHereLabel}
              </span>
            </span>
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center py-8">
        <LobbySwarm participantCount={participantCount} identity={identity} isGlowing={isGlowing} />
        <div className="pointer-events-none absolute flex flex-col items-center gap-1">
          <span className="font-inter text-[21px] text-[#f4f4f5]">
            {participantCount.toLocaleString()}
          </span>
          <span className="font-inter text-[15px] text-[#929297]">are waiting</span>
        </div>
      </div>
    </div>
  );
}
