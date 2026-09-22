"use client";

import { useState } from "react";
import SiteHeader from "@/components/layout/SiteHeader";
import JoinRoomButton from "@/components/rooms/JoinRoomButton";
import LeaveRoomButton from "@/components/rooms/LeaveRoomButton";
import RoomMoodCard from "@/components/rooms/RoomMoodCard";
import LobbyCard from "@/components/rooms/LobbyCard";
import RoomEnergyBar from "@/components/rooms/RoomEnergyBar";
import RoomChat from "@/components/rooms/RoomChat";
import EditRoomModal from "@/components/rooms/EditRoomModal";
import { CountdownRow } from "@/components/rooms/CountdownUnits";
import { useCountdown } from "@/hooks/useCountdown";
import { useStaggerEntrance } from "@/hooks/useStaggerEntrance";
import type { Room, RoomAnalytics } from "@/lib/rooms";
import type { Mood, MoodBreakdown } from "@/lib/roomMood";

type RoomDetailScreenProps = {
  room: Room;
  anonId: string | null;
  isOwner: boolean;
  hasJoined: boolean;
  hasEnded: boolean;
  joinedAt: string | null;
  lastSeenAt: string | null;
  moodBreakdown: MoodBreakdown[];
  viewerMood: Mood | null;
  roomEnergy: number;
  analytics: RoomAnalytics | null;
};

const MOOD_EMOJI: Record<Mood, string> = {
  Hype: "🔥",
  Nervous: "😬",
  Tired: "😴",
  Curious: "🤔",
  "Just Here": "😌",
};

// Same max-width + responsive padding as NavBar (src/components/home/NavBar.tsx),
// so the hero image, its content, and the Room Mood / Lobby row below all share
// the nav's exact left/right edges instead of bleeding past it.
const ALIGNED_CONTAINER_CLASS = "mx-auto w-full max-w-[1214px] px-5 sm:px-8 lg:px-0";

function PrimaryPill({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <span className="relative flex size-full items-center justify-center overflow-hidden rounded-[9px]">
      <span
        aria-hidden
        className="absolute inset-0 rounded-[9px]"
        style={{
          backgroundImage: danger
            ? "linear-gradient(180.99deg, rgb(255,73,73) 19.37%, rgb(255,39,39) 40.857%, rgb(255,33,33) 65.087%, rgb(255,30,30) 97.546%)"
            : "linear-gradient(180.99deg, rgb(228,221,221) 19.37%, rgb(220,220,220) 40.857%, rgb(216,213,213) 65.087%, rgb(209,209,209) 97.546%)",
        }}
      />
      <span
        className={`relative font-figtree text-[14px] font-medium ${danger ? "text-white" : "text-black"}`}
      >
        {label}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(28,28,28,0.05)]"
      />
    </span>
  );
}

export default function RoomDetailScreen({
  room,
  anonId,
  isOwner,
  hasJoined,
  hasEnded,
  joinedAt,
  lastSeenAt,
  moodBreakdown,
  viewerMood,
  roomEnergy,
  analytics,
}: RoomDetailScreenProps) {
  const countdown = useCountdown(room.date);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  // Same staggered mount-in treatment as the dropdown menu — each major
  // section fades/slides up a beat after the last.
  const entrance = useStaggerEntrance(90, 70);
  const heroTextEntrance = entrance();
  const heroButtonsEntrance = entrance();
  const energyBarEntrance = entrance();
  const endedDividerEntrance = entrance();
  const endedStatsEntrance = entrance();
  const endedShareEntrance = entrance();
  const moodCardEntrance = entrance();
  const lobbyCardEntrance = entrance();

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/rooms/${room.id}` : "";

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — no-op, the room link is still reachable via the URL bar.
    }
  }

  const topMoodEmoji = analytics?.topMood ? MOOD_EMOJI[analytics.topMood] : "🤷";

  return (
    <div className="relative min-h-screen w-full bg-bg">
      <div className="relative">
        {/* Large Media Frame — capped to a portion of the viewport height
            (not a full-bleed aspect ratio) so it never dominates the whole
            screen regardless of image shape or window size. */}
        <div className="relative min-h-[90vh] w-full overflow-hidden bg-black sm:h-[90vh]">
          {/* Image fills the entire hero edge-to-edge (object-cover, full bleed).
              Only the CONTENT below (text, buttons, energy bar) is aligned to
              the nav's own width — the photo itself is never inset. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={room.imageUrl} className="absolute inset-0 size-full object-cover" />

          {/* Fades to black at both the very top (so the fixed nav stays
              legible over any image) and the bottom (for the text/buttons). */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 16%, rgba(0,0,0,0) 38.473%, rgba(0,0,0,0.92) 92.271%)",
            }}
          />

          {!hasEnded ? (
            <div className={`absolute inset-0 ${ALIGNED_CONTAINER_CLASS}`}>
              <div className="relative size-full">
                <div className="absolute bottom-4 left-0 flex max-w-[calc(100%-16px)] flex-col gap-4 sm:bottom-9 sm:gap-[25px] lg:bottom-[100px]">
                  <div
                    className={`flex flex-col gap-[17px] text-white ${heroTextEntrance.className}`}
                    style={heroTextEntrance.style}
                  >
                    <div className="flex w-full max-w-[271px] flex-col gap-[4px]">
                      <p className="font-satoshi text-[20px] leading-[1.15] sm:text-[26px]">
                        {room.name}
                      </p>
                      <p className="font-satoshi text-[14px] opacity-65 sm:text-[18px]">
                        {room.participantCount.toLocaleString()} waiting
                      </p>
                    </div>
                    {countdown ? <CountdownRow countdown={countdown} /> : null}
                  </div>

                  <div
                    className={`flex flex-col gap-[15px] ${heroButtonsEntrance.className}`}
                    style={heroButtonsEntrance.style}
                  >
                    <div className="flex items-end gap-[9px]">
                      {isOwner ? (
                        <button
                          type="button"
                          onClick={() => setEditing(true)}
                          className="relative flex h-[44px] w-[127px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)]"
                        >
                          <PrimaryPill label="Edit Room" />
                        </button>
                      ) : hasJoined ? (
                        <LeaveRoomButton
                          roomId={room.id}
                          className="relative flex h-[44px] w-[127px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)] disabled:opacity-60"
                        >
                          <PrimaryPill label="Stop Waiting" danger />
                        </LeaveRoomButton>
                      ) : (
                        <JoinRoomButton
                          roomId={room.id}
                          navigateAfterJoin={false}
                          className="relative flex h-[44px] w-[127px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)] disabled:opacity-60"
                        >
                          <PrimaryPill label="Join Wait" />
                        </JoinRoomButton>
                      )}

                      <button
                        type="button"
                        onClick={handleCopyLink}
                        aria-label="Copy room link"
                        className="relative flex size-[44px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[rgba(41,41,41,0.42)]"
                        style={{ backgroundImage: "linear-gradient(180deg, #1d1d1e, #1b1b1d)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="" className="size-[24px]" src="/icons/copy-01.svg" />
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-[-1px] rounded-[inherit] shadow-[inset_0px_1px_1px_0px_#404040]"
                        />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="flex w-fit items-center gap-[6px]"
                    >
                      <span className="font-figtree text-[14px] font-medium text-[#dcdcdc]">
                        {copied ? "Link Copied!" : "Share Room"}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" className="size-[18px]" src="/icons/share-01.svg" />
                    </button>
                  </div>

                  {/* Below sm, there's no room beside the content for a
                      right-docked bar, so it stacks in-flow here instead. */}
                  <div className={`sm:hidden ${energyBarEntrance.className}`} style={energyBarEntrance.style}>
                    <RoomEnergyBar energy={roomEnergy} />
                  </div>
                </div>

                {/* From sm up, right-aligned but anchored to the same bottom
                    offset as the left content stack so both sit on one line. */}
                <div
                  className={`absolute bottom-9 right-0 hidden sm:block lg:bottom-[100px] ${energyBarEntrance.className}`}
                  style={energyBarEntrance.style}
                >
                  <RoomEnergyBar energy={roomEnergy} />
                </div>
              </div>
            </div>
          ) : analytics ? (
            // Figma centers this analytics block as its own narrower (921px)
            // column rather than stretching it to the nav's full width. On
            // mobile the stat cards stack into a single tall column, which
            // can run taller than the 90vh hero — this stays in normal flow
            // there (growing the hero to fit, pt- clears the fixed nav)
            // instead of the absolute/inset-0 + justify-end used from sm up,
            // which relied on everything fitting within a hard-clipped box
            // and was silently cutting the top of the stack off on mobile.
            <div className="relative px-4 pb-4 pt-[104px] sm:absolute sm:inset-0 sm:px-8 sm:pb-0 sm:pt-0">
              <div className="mx-auto flex w-full max-w-[921px] flex-col items-center gap-[7px] sm:h-full sm:justify-end sm:pb-7">
                <div
                  className={`flex w-full items-center gap-[9px] opacity-70 ${endedDividerEntrance.className}`}
                  style={endedDividerEntrance.style}
                >
                  <span className="h-px flex-1 bg-white" />
                  <p className="whitespace-nowrap font-satoshi text-[12px] text-white">
                    Wait has ended
                  </p>
                  <span className="h-px flex-1 bg-white" />
                </div>

                <div
                  className={`flex w-full flex-col gap-[8px] rounded-[20px] border border-[rgba(255,244,244,0.1)] bg-[rgba(0,0,0,0.31)] p-[9px] sm:flex-row ${endedStatsEntrance.className}`}
                  style={endedStatsEntrance.style}
                >
                  <div className="h-[140px] w-full shrink-0 overflow-hidden rounded-[16px] bg-black sm:h-[177px] sm:w-[204px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" src={room.imageUrl} className="size-full object-cover" />
                  </div>
                  <div className="grid w-full grid-cols-1 gap-[8px] sm:grid-cols-3">
                    <div className="flex flex-col justify-center gap-[14px] rounded-[16px] border border-[rgba(255,255,255,0.09)] bg-[#0c0d10] p-[14px] sm:h-[177px]">
                      <div className="flex flex-col gap-[6px]">
                        <div className="flex items-center gap-[6px] opacity-70">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt="" className="size-[16px]" src="/icons/user-02.svg" />
                          <p className="font-satoshi text-[12px] text-[#dcdcdc]">Event</p>
                        </div>
                        <p className="font-satoshi text-[14px] text-[#f4f4f5]">{room.name}</p>
                      </div>
                      <div className="flex flex-col gap-[6px]">
                        <div className="flex items-center gap-[6px] opacity-70">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt="" className="size-[16px]" src="/icons/calendar-03.svg" />
                          <p className="font-satoshi text-[12px] text-[#dcdcdc]">Date</p>
                        </div>
                        <p className="font-satoshi text-[14px] text-[#f4f4f5]">{room.date}</p>
                      </div>
                      <div className="flex flex-col gap-[6px]">
                        <div className="flex items-center gap-[6px] opacity-70">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt="" className="size-[16px]" src="/icons/time-04.svg" />
                          <p className="font-satoshi text-[12px] text-[#dcdcdc]">Total wait time</p>
                        </div>
                        <p className="font-satoshi text-[14px] text-[#f4f4f5]">
                          {analytics.totalWaitDays} {analytics.totalWaitDays === 1 ? "day" : "days"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-[14px] rounded-[16px] border border-[rgba(255,255,255,0.09)] bg-[#0c0d10] p-[14px] sm:h-[177px]">
                      <div className="flex flex-col gap-[6px]">
                        <div className="flex items-center gap-[6px] opacity-70">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt="" className="size-[16px]" src="/icons/user-02.svg" />
                          <p className="font-satoshi text-[12px] text-[#dcdcdc]">People Who Waited</p>
                        </div>
                        <p className="font-satoshi text-[24px] text-[#f4f4f5]">
                          {analytics.peopleWhoWaited.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-col gap-[6px]">
                        <div className="flex items-center gap-[6px] opacity-70">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt="" className="size-[16px]" src="/icons/time-04.svg" />
                          <p className="font-satoshi text-[12px] text-[#dcdcdc]">Average Wait Time</p>
                        </div>
                        <p className="font-satoshi text-[24px] text-[#f4f4f5]">
                          {analytics.averageWaitDays} {analytics.averageWaitDays === 1 ? "day" : "days"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-[4px] rounded-[16px] border border-[rgba(255,255,255,0.09)] bg-[#0c0d10] p-[14px] text-center sm:h-[177px]">
                      <div className="flex items-center gap-[6px] self-start opacity-70">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="" className="size-[16px]" src="/icons/look-top.svg" />
                        <p className="font-satoshi text-[12px] text-[#dcdcdc]">
                          {analytics.topMood ? `Majority were ${analytics.topMood}` : "No mood votes yet"}
                        </p>
                      </div>
                      <span className="text-[64px] leading-none sm:text-[80px] lg:text-[96px]">{topMoodEmoji}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`flex w-fit items-center gap-[6px] opacity-70 ${endedShareEntrance.className}`}
                  style={endedShareEntrance.style}
                >
                  <span className="font-figtree text-[12px] text-[#dcdcdc]">
                    {copied ? "Link Copied!" : "Share Room"}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="size-[16px]" src="/icons/share-01.svg" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <SiteHeader anonId={anonId} />
      </div>

      {!hasEnded ? (
        <div className={`flex flex-col gap-[10px] py-[10px] ${ALIGNED_CONTAINER_CLASS} lg:flex-row`}>
          <div className={`flex w-full lg:w-auto ${moodCardEntrance.className}`} style={moodCardEntrance.style}>
            <RoomMoodCard
              roomId={room.id}
              breakdown={moodBreakdown}
              viewerMood={viewerMood}
              canVote={hasJoined}
            />
          </div>
          <div className={`flex w-full flex-1 ${lobbyCardEntrance.className}`} style={lobbyCardEntrance.style}>
            <LobbyCard
              roomId={room.id}
              participantCount={room.participantCount}
              hasJoined={hasJoined}
              joinedAt={joinedAt}
              lastSeenAt={lastSeenAt}
            />
          </div>
        </div>
      ) : (
        <div className="h-[10px]" />
      )}

      {!hasEnded ? <RoomChat roomId={room.id} hasJoined={hasJoined} /> : null}

      {editing ? (
        <EditRoomModal room={room} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      ) : null}
    </div>
  );
}
