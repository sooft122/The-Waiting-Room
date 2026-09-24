"use client";

import { useState } from "react";
import { useElapsed } from "@/hooks/useElapsed";
import { useCooldown } from "@/hooks/useCooldown";
import { CHECK_IN_COOLDOWN_MS } from "@/lib/roomPresenceConstants";
import type { GlowingSeed } from "@/lib/roomPresence";
import LobbySwarm from "./LobbySwarm";

// Fixed accent for the "You've been waiting" status dot while glowing — just
// this one viewer's own status, so unlike the swarm's dots it doesn't need
// to visually distinguish between different people.
const STILL_HERE_GLOW_COLOR = "#7ce8ff";

type LobbyCardProps = {
  roomId: string;
  participantCount: number;
  hasJoined: boolean;
  joinedAt: string | null;
  lastSeenAt: string | null;
  /** Anonymous seeds for everyone currently checked in — including this
   * viewer, once their own check-in has round-tripped through the parent's
   * live data — rendered as glowing dots in the swarm below. */
  glowingDots: GlowingSeed[];
  /** Called after a check-in lands successfully — lets the parent re-poll
   * the shared live room data right away, so this viewer's own dot starts
   * glowing in the swarm without waiting for the next regular poll tick. */
  onCheckedIn?: () => void;
};

export default function LobbyCard({
  roomId,
  participantCount,
  hasJoined,
  joinedAt,
  lastSeenAt,
  glowingDots,
  onCheckedIn,
}: LobbyCardProps) {
  const [checkingIn, setCheckingIn] = useState(false);
  const [localLastSeenAt, setLocalLastSeenAt] = useState(lastSeenAt);
  const elapsed = useElapsed(joinedAt);
  // The glow lasts exactly as long as the cooldown — previously it faded
  // after 15 minutes while the button stayed locked for a full hour, which
  // read as "am I still checked in or not?". Now they match: glowing for as
  // long as you're not allowed to check in again.
  const cooldown = useCooldown(localLastSeenAt, CHECK_IN_COOLDOWN_MS);
  const isGlowing = cooldown.active;

  async function handleCheckIn() {
    if (cooldown.active) return;
    setCheckingIn(true);
    try {
      const response = await fetch(`/api/rooms/${roomId}/presence`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (data.lastSeenAt) setLocalLastSeenAt(data.lastSeenAt);
      onCheckedIn?.();
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
                className="size-[5px] shrink-0 rounded-full bg-[#7cff8f]"
                style={isGlowing ? { backgroundColor: STILL_HERE_GLOW_COLOR } : undefined}
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
        <LobbySwarm participantCount={participantCount} glowingDots={glowingDots} />
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
