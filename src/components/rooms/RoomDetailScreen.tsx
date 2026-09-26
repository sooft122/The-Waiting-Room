"use client";

import { useCallback, useEffect, useState } from "react";
import SiteHeader from "@/components/layout/SiteHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import JoinRoomButton from "@/components/rooms/JoinRoomButton";
import LeaveRoomButton from "@/components/rooms/LeaveRoomButton";
import RoomMoodCard from "@/components/rooms/RoomMoodCard";
import LobbyCard from "@/components/rooms/LobbyCard";
import RoomEnergyBar from "@/components/rooms/RoomEnergyBar";
import RoomChat from "@/components/rooms/RoomChat";
import EditRoomModal from "@/components/rooms/EditRoomModal";
import CountriesCard from "@/components/rooms/CountriesCard";
import RoomDescriptionCard from "@/components/rooms/RoomDescriptionCard";
import { CountdownRow } from "@/components/rooms/CountdownUnits";
import { useCountdown } from "@/hooks/useCountdown";
import { useStaggerEntrance } from "@/hooks/useStaggerEntrance";
import type { Room, RoomAnalytics } from "@/lib/rooms";
import type { Mood, MoodBreakdown } from "@/lib/roomMood";
import type { GlowingSeed } from "@/lib/roomPresence";
import type { CountryBreakdown } from "@/lib/roomCountry";
import { getRoomEndTime } from "@/lib/roomTime";

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
  glowingDots: GlowingSeed[];
  countries: CountryBreakdown[];
  /** VAPID public key for new-message notifications — null when they aren't set up. */
  pushPublicKey: string | null;
};

// How often every viewer polls for what everyone ELSE in the room has done
// (joined, voted a mood, checked in) — the page's own server data only ever
// refreshes for the current viewer's own actions, so without this, someone
// else's join/vote/check-in only ever showed up after a manual reload.
const LIVE_POLL_INTERVAL_MS = 5000;

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
  glowingDots,
  countries,
  pushPublicKey,
}: RoomDetailScreenProps) {
  const countdown = useCountdown(getRoomEndTime(room).toISOString());
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "description">("overview");

  // Everything here that anyone else in the room can change just by using
  // it (joining, voting, checking in) — kept separate from the props above,
  // which only ever update for the CURRENT viewer's own actions (a fresh
  // server render after join/leave). Seeded from the initial server props,
  // then kept current for everyone by polling below.
  const [live, setLive] = useState({
    participantCount: room.participantCount,
    moodBreakdown,
    roomEnergy,
    glowingDots,
    countries,
  });

  // A join/leave still triggers a real server refresh (it also needs to flip
  // this viewer's own hasJoined-dependent UI) — fold its fresh numbers into
  // `live` immediately instead of waiting for the next poll tick.
  useEffect(() => {
    setLive((prev) => ({
      ...prev,
      participantCount: room.participantCount,
      moodBreakdown,
      roomEnergy,
      glowingDots,
      countries,
    }));
  }, [room.participantCount, moodBreakdown, roomEnergy, glowingDots, countries]);

  const refreshLive = useCallback(async () => {
    if (hasEnded) return;
    try {
      const response = await fetch(`/api/rooms/${room.id}/live`);
      if (!response.ok) return;
      const data = await response.json();
      setLive((prev) => ({
        participantCount:
          typeof data.participantCount === "number" ? data.participantCount : prev.participantCount,
        moodBreakdown: Array.isArray(data.moodBreakdown) ? data.moodBreakdown : prev.moodBreakdown,
        roomEnergy: typeof data.roomEnergy === "number" ? data.roomEnergy : prev.roomEnergy,
        glowingDots: Array.isArray(data.glowingDots) ? data.glowingDots : prev.glowingDots,
        countries: Array.isArray(data.countries) ? data.countries : prev.countries,
      }));
    } catch {
      // Transient — the next poll tick (or the next on-demand call) retries.
    }
  }, [room.id, hasEnded]);

  useEffect(() => {
    if (hasEnded) return;
    const id = setInterval(refreshLive, LIVE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasEnded, refreshLive]);

  // Same staggered mount-in treatment as the dropdown menu — each major
  // section fades/slides up a beat after the last.
  const entrance = useStaggerEntrance(90, 70);
  const breadcrumbEntrance = entrance();
  const heroTextEntrance = entrance();
  const heroButtonsEntrance = entrance();
  const energyBarEntrance = entrance();
  const endedDividerEntrance = entrance();
  const endedStatsEntrance = entrance();
  const endedShareEntrance = entrance();
  const tabsEntrance = entrance();
  const moodCardEntrance = entrance();
  const lobbyCardEntrance = entrance();
  const countriesCardEntrance = entrance();
  const descriptionCardEntrance = entrance();

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
            screen regardless of image shape or window size. The ended state
            fills the full viewport instead — it's a summary screen on its
            own, not a photo backdrop for live content sitting below it. */}
        <div
          className={`relative w-full overflow-hidden bg-black ${
            hasEnded ? "min-h-screen sm:h-screen" : "h-[90vh]"
          }`}
        >
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

          {/* Same vertical position every other page's own content starts
              at (their pt-[104px]/[112px]/[125px]) — sits just below the
              fixed nav. The hero's own top-fade alone doesn't guarantee
              contrast (a bright thumbnail can still wash it out up here),
              so it also carries its own drop-shadow rather than relying on
              the gradient underneath it. */}
          <div
            className={`absolute left-0 right-0 top-[104px] z-10 sm:top-[112px] lg:top-[125px] ${ALIGNED_CONTAINER_CLASS}`}
          >
            <Breadcrumbs
              items={[{ label: "Discover Rooms", href: "/rooms" }, { label: room.name }]}
              className={`drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] ${breadcrumbEntrance.className}`}
              style={breadcrumbEntrance.style}
            />
          </div>

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
                        {live.participantCount.toLocaleString()} waiting
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
                    <RoomEnergyBar energy={live.roomEnergy} />
                  </div>
                </div>

                {/* From sm up, right-aligned but anchored to the same bottom
                    offset as the left content stack so both sit on one line. */}
                <div
                  className={`absolute bottom-9 right-0 hidden sm:block lg:bottom-[100px] ${energyBarEntrance.className}`}
                  style={energyBarEntrance.style}
                >
                  <RoomEnergyBar energy={live.roomEnergy} />
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
        <div className={`pt-[10px] ${ALIGNED_CONTAINER_CLASS} ${tabsEntrance.className}`} style={tabsEntrance.style}>
          <div className="flex items-center gap-[7px]">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`rounded-[30px] px-[14px] py-[10px] font-satoshi text-[14px] ${
                activeTab === "overview"
                  ? "bg-gradient-to-b from-[#a8a8a8] to-[#d3d3d3] text-black"
                  : "bg-[#1d1d1d] text-[#d0d0d0] opacity-65"
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("description")}
              className={`rounded-[30px] px-[14px] py-[10px] font-satoshi text-[14px] ${
                activeTab === "description"
                  ? "bg-gradient-to-b from-[#a8a8a8] to-[#d3d3d3] text-black"
                  : "bg-[#1d1d1d] text-[#d0d0d0] opacity-65"
              }`}
            >
              Description
            </button>
          </div>
        </div>
      ) : (
        <div className="h-[10px]" />
      )}

      {!hasEnded && activeTab === "overview" ? (
        <div className={`flex flex-col gap-[10px] py-[10px] ${ALIGNED_CONTAINER_CLASS} lg:flex-row`}>
          <div className={`flex w-full lg:w-auto ${moodCardEntrance.className}`} style={moodCardEntrance.style}>
            <RoomMoodCard
              roomId={room.id}
              breakdown={live.moodBreakdown}
              viewerMood={viewerMood}
              canVote={hasJoined}
              onVoted={refreshLive}
            />
          </div>
          <div className={`flex w-full flex-1 ${lobbyCardEntrance.className}`} style={lobbyCardEntrance.style}>
            <LobbyCard
              roomId={room.id}
              participantCount={live.participantCount}
              hasJoined={hasJoined}
              joinedAt={joinedAt}
              lastSeenAt={lastSeenAt}
              glowingDots={live.glowingDots}
              onCheckedIn={refreshLive}
            />
          </div>
        </div>
      ) : null}

      {!hasEnded && activeTab === "overview" ? (
        <div
          className={`pb-[10px] ${ALIGNED_CONTAINER_CLASS} ${countriesCardEntrance.className}`}
          style={countriesCardEntrance.style}
        >
          <CountriesCard countries={live.countries} />
        </div>
      ) : null}

      {!hasEnded && activeTab === "description" ? (
        <div
          className={`py-[10px] ${ALIGNED_CONTAINER_CLASS} ${descriptionCardEntrance.className}`}
          style={descriptionCardEntrance.style}
        >
          <RoomDescriptionCard
            description={room.description}
            ctaText={room.ctaText}
            ctaLink={room.ctaLink}
          />
        </div>
      ) : null}

      {!hasEnded ? (
        <RoomChat roomId={room.id} hasJoined={hasJoined} pushPublicKey={pushPublicKey} />
      ) : null}

      {editing ? (
        <EditRoomModal room={room} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      ) : null}
    </div>
  );
}
