"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Mood, MoodBreakdown } from "@/lib/roomMood";

const MOOD_EMOJI: Record<Mood, string> = {
  Hype: "🔥",
  Nervous: "😬",
  Tired: "😴",
  Curious: "🤔",
  "Just Here": "😌",
};

// One solid accent per mood, used only for the SELECTED option — hover
// stays a uniform white "light on glass" (.room-card-glow), not colored.
const MOOD_COLOR: Record<Mood, string> = {
  Hype: "212, 165, 46",
  Nervous: "124, 77, 220",
  Tired: "220, 77, 90",
  Curious: "62, 122, 220",
  "Just Here": "180, 180, 180",
};

type RoomMoodCardProps = {
  roomId: string;
  breakdown: MoodBreakdown[];
  viewerMood: Mood | null;
  canVote: boolean;
};

export default function RoomMoodCard({ roomId, breakdown, viewerMood, canVote }: RoomMoodCardProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [localMood, setLocalMood] = useState(viewerMood);

  // Percentages stay hidden until the viewer has cast a vote of their own —
  // voting again (reselecting) is always allowed and keeps them visible.
  const hasVoted = localMood !== null;

  async function handleVote(mood: Mood) {
    if (!canVote || pending || mood === localMood) return;
    setPending(true);
    setLocalMood(mood);
    try {
      await fetch(`/api/rooms/${roomId}/mood`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-[20px] bg-[#08090b] pb-[10px] lg:w-[483px]">
      <div className="flex h-[50px] w-full shrink-0 items-center bg-[#101113] px-[17px]">
        <h2 className="font-figtree text-[14px] text-white">Room Mood</h2>
      </div>
      <div className="flex flex-col gap-[10px] px-[10px] pt-[10px]">
        {breakdown.map((entry) => {
          const isSelected = localMood === entry.mood;
          const rgb = MOOD_COLOR[entry.mood];
          return (
            <button
              key={entry.mood}
              type="button"
              data-mood={entry.mood}
              data-selected={isSelected}
              onClick={() => handleVote(entry.mood)}
              disabled={!canVote || pending}
              className="mood-row room-card-glow relative flex h-[80px] w-full items-center justify-between overflow-hidden rounded-[10px] border px-[8px] text-left transition-colors disabled:cursor-default"
              style={{
                backgroundColor: "#111113",
                borderColor: isSelected ? `rgba(${rgb}, 0.6)` : "transparent",
              }}
            >
              {/* Poll-style fill bar: grows to the option's percentage; only
                  tinted once you've voted (percentages are hidden before that). */}
              {hasVoted ? (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out"
                  style={{
                    width: `${entry.percent}%`,
                    backgroundColor: isSelected ? `rgba(${rgb}, 0.22)` : "rgba(255,255,255,0.05)",
                  }}
                />
              ) : null}

              <div className="relative flex items-center gap-[18px]">
                <div className="flex size-[64px] shrink-0 items-center justify-center rounded-[8px] bg-white/5 text-[30px]">
                  {MOOD_EMOJI[entry.mood]}
                </div>
                <p className="font-satoshi text-[20px] text-white">{entry.mood}</p>
              </div>

              <div className="relative flex items-center gap-[10px]">
                {hasVoted ? (
                  <p className="font-figtree text-[14px] text-white opacity-70">{entry.percent}%</p>
                ) : null}
                <span
                  aria-hidden
                  className="flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors"
                  style={{
                    borderColor: isSelected ? `rgb(${rgb})` : "rgba(255,255,255,0.3)",
                  }}
                >
                  {isSelected ? (
                    <span
                      className="size-[10px] rounded-full"
                      style={{ backgroundColor: `rgb(${rgb})` }}
                    />
                  ) : null}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {!canVote ? (
        <p className="px-[27px] pt-[10px] font-inter text-[12px] text-white/40">
          Join the room to share your mood.
        </p>
      ) : !hasVoted ? (
        <p className="px-[27px] pt-[10px] font-inter text-[12px] text-white/40">
          Pick a mood to see how everyone else is feeling.
        </p>
      ) : null}
    </div>
  );
}
