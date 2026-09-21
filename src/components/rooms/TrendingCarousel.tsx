"use client";

import { useEffect, useState } from "react";
import type { Room } from "@/lib/rooms";
import { useCountdown } from "@/hooks/useCountdown";
import { CountdownRow } from "./CountdownUnits";
import JoinRoomButton from "./JoinRoomButton";

type TrendingCarouselProps = {
  rooms: Room[];
};

/**
 * Full-bleed hero carousel, one room at a time. There's no real "trending"
 * signal yet (no join/view counts), so for now this just cycles through
 * whichever rooms were passed in — the caller decides the selection logic.
 */
export default function TrendingCarousel({ rooms }: TrendingCarouselProps) {
  const [index, setIndex] = useState(0);
  const room = rooms[Math.min(index, rooms.length - 1)] ?? null;
  const countdown = useCountdown(room?.date ?? new Date(Date.now() + 86_400_000).toISOString());

  useEffect(() => {
    if (rooms.length <= 1) return;
    const id = setInterval(() => setIndex((current) => (current + 1) % rooms.length), 6000);
    return () => clearInterval(id);
  }, [rooms.length]);

  if (!room) return null;

  const hasEnded = countdown === null;

  function goTo(nextIndex: number) {
    setIndex((nextIndex + rooms.length) % rooms.length);
  }

  return (
    <div className="relative h-[440px] w-full overflow-hidden rounded-[20px] bg-black sm:h-[360px] lg:h-[429px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={room.imageUrl} className="absolute inset-0 size-full object-cover" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0) 38.473%, #000000 92.271%)",
        }}
      />

      <div className="absolute inset-x-5 bottom-8 flex flex-col items-start gap-3 sm:inset-x-[50px] sm:bottom-[50px] sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1 font-satoshi text-white">
          <p className="text-[14px]">🔥 Trending</p>
          <p className="max-w-full truncate text-[20px] sm:max-w-[50vw] sm:text-[26px]">{room.name}</p>
          <p className="text-[15px] opacity-65 sm:text-[18px]">
            {room.participantCount.toLocaleString()} {hasEnded ? "waited" : "waiting"}
          </p>
        </div>

        {hasEnded ? (
          <p className="shrink-0 font-satoshi text-[14px] text-white opacity-65">Wait Ended</p>
        ) : (
          <div className="flex shrink-0 flex-col items-start gap-[17px] text-white">
            <CountdownRow countdown={countdown} />
            <JoinRoomButton
              roomId={room.id}
              className="relative flex w-[161px] flex-col items-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)] disabled:opacity-70"
            >
              <span className="relative flex w-full items-center justify-center gap-1 overflow-hidden rounded-[9px] px-[30px] py-2">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-[9px]"
                  style={{
                    backgroundImage:
                      "linear-gradient(180.56deg, rgb(228,221,221) 19.37%, rgb(220,220,220) 40.857%, rgb(216,213,213) 65.087%, rgb(209,209,209) 97.546%)",
                  }}
                />
                <span className="relative font-figtree text-[12px] font-medium text-black">
                  Join Room
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="relative size-3.5" src="/icons/arrow-right-02.svg" />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(28,28,28,0.05)]"
                />
              </span>
            </JoinRoomButton>
          </div>
        )}
      </div>

      {rooms.length > 1 ? (
        <>
          {/* Below sm, the content stacks (taller) instead of sitting in a
              row beside itself, so the arrows sit higher up — fixed to the
              top of the box — instead of vertically centered across the
              whole (now taller) card, to stay clear of it. */}
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Previous room"
            className="absolute left-3 top-16 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 backdrop-blur transition-colors hover:bg-black/60 sm:top-1/2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className="size-5 rotate-180" src="/icons/arrow-right-01.svg" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Next room"
            className="absolute right-3 top-16 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 backdrop-blur transition-colors hover:bg-black/60 sm:top-1/2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className="size-5" src="/icons/arrow-right-01.svg" />
          </button>

          <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
            {rooms.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Go to slide ${slideIndex + 1}`}
                onClick={() => goTo(slideIndex)}
                className={`h-1.5 rounded-full transition-all ${
                  slideIndex === index ? "w-6 bg-white" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
