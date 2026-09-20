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
    // overflow-hidden keeps each row's glow contained to the card's own
    // rounded silhouette — it still shows in the gaps between rows, it just
    // can't leak out past the card's edges (which read as "behind the card").
    <div className="flex w-full flex-col overflow-hidden rounded-[20px] bg-[#08090b] pb-[24px] lg:w-[483px]">
      <div className="flex h-[50px] w-full shrink-0 items-center bg-[#101113] px-[17px]">
        <h2 className="font-figtree text-[14px] text-white">Room Mood</h2>
      </div>
      <div className="flex flex-col gap-[28px] px-[16px] pt-[24px]">
        {breakdown.map((entry) => {
          const isSelected = localMood === entry.mood;
          return (
            <button
              key={entry.mood}
              type="button"
              data-mood={entry.mood}
              data-selected={isSelected}
              onClick={() => handleVote(entry.mood)}
              disabled={!canVote || pending}
              className="mood-row flex h-[80px] w-full items-center justify-between rounded-[10px] bg-[#111113] px-[8px] text-left disabled:cursor-default"
            >
              <div className="flex items-center gap-[18px]">
                <div className="flex size-[64px] shrink-0 items-center justify-center rounded-[8px] bg-white/5 text-[30px]">
                  {MOOD_EMOJI[entry.mood]}
                </div>
                <p className="font-satoshi text-[20px] text-white">{entry.mood}</p>
              </div>
              {hasVoted ? (
                <div className="flex items-center rounded-[6px] bg-[#232323] px-[8px] py-[6px]">
                  <p className="font-figtree text-[16px] text-white opacity-70">{entry.percent}%</p>
                </div>
              ) : null}
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
