"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SiteHeader from "@/components/layout/SiteHeader";
import { ROOM_CATEGORIES, isRoomActive } from "@/lib/rooms";
import type { Room } from "@/lib/rooms";
import { getSectionRooms } from "@/lib/roomSections";
import { useStaggerEntrance } from "@/hooks/useStaggerEntrance";
import { useRoomModal } from "./RoomModalProvider";
import TrendingCarousel from "./TrendingCarousel";
import RoomSectionRow from "./RoomSectionRow";
import CategoryFilterPills from "./CategoryFilterPills";
import DiscoverBottomBar from "./DiscoverBottomBar";

const CATEGORY_FILTERS = ["All", ...ROOM_CATEGORIES] as const;
type CategoryFilter = (typeof CATEGORY_FILTERS)[number];
type ViewMode = "discover" | "mine";

type DiscoverRoomsScreenProps = {
  rooms: Room[];
  anonId: string | null;
  joinedRoomIds: string[];
};

export default function DiscoverRoomsScreen({
  rooms,
  anonId,
  joinedRoomIds,
}: DiscoverRoomsScreenProps) {
  const joinedRoomIdSet = useMemo(() => new Set(joinedRoomIds), [joinedRoomIds]);
  const router = useRouter();
  const { openCreateRoom } = useRoomModal();
  const { data: session } = useSession();

  const entrance = useStaggerEntrance();
  const headerEntrance = entrance();
  const carouselEntrance = entrance();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [viewMode, setViewMode] = useState<ViewMode>("discover");
  const [searchQuery, setSearchQuery] = useState("");

  const myIdentity = session?.user?.email ?? (anonId ? `anon:${anonId}` : null);

  // Discover Rooms is a surface for finding rooms to join, not an archive —
  // ended rooms belong on Profile/Archive instead. Filtering here, before
  // anything downstream (counts, sections, the carousel), keeps every part
  // of this page consistent about only ever showing active rooms.
  const activeRooms = useMemo(() => rooms.filter(isRoomActive), [rooms]);

  const scopedRooms = useMemo(() => {
    if (viewMode === "discover") return activeRooms;
    if (!myIdentity) return [];
    return activeRooms.filter((room) => room.createdBy === myIdentity);
  }, [activeRooms, viewMode, myIdentity]);

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      All: scopedRooms.length,
      Sports: 0,
      Entertainment: 0,
      Gaming: 0,
      Technology: 0,
      Culture: 0,
      Events: 0,
      Other: 0,
    };
    for (const room of scopedRooms) counts[room.category] += 1;
    return counts;
  }, [scopedRooms]);

  const filteredRooms = useMemo(
    () =>
      categoryFilter === "All"
        ? scopedRooms
        : scopedRooms.filter((room) => room.category === categoryFilter),
    [scopedRooms, categoryFilter],
  );

  // Trending = the most-waited-for rooms, ranked by live participant count.
  // filteredRooms is already active-only (via activeRooms above), so no
  // separate ended-room filter is needed here. Spread before sort so this
  // never mutates filteredRooms itself, which RoomSectionRow below relies
  // on staying in its original (newest-first) order.
  const carouselRooms = useMemo(
    () => [...filteredRooms].sort((a, b) => b.participantCount - a.participantCount).slice(0, 4),
    [filteredRooms],
  );

  // "Starting Soon" and "Mostly Crowded" need signals we don't track yet
  // (a soon-to-start window, and live participant counts) — deliberately
  // left empty for now rather than faked.
  const startingSoonRooms = useMemo(
    () => getSectionRooms(activeRooms, "starting-soon"),
    [activeRooms],
  );
  const mostlyCrowdedRooms = useMemo(
    () => getSectionRooms(activeRooms, "mostly-crowded"),
    [activeRooms],
  );

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="relative min-h-screen w-full bg-bg">
      <SiteHeader anonId={anonId} />

      {/* pt compensates for the nav bar now being fixed (out of normal
          flow) instead of pushing this content down itself. */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1214px] flex-col gap-10 px-5 pb-48 pt-[104px] sm:px-8 sm:pt-[112px] lg:px-0 lg:pt-[125px]">
        <div className={`flex flex-col gap-3 ${headerEntrance.className}`} style={headerEntrance.style}>
          <h1 className="font-satoshi text-[24px] leading-[1.08] text-white">
            {viewMode === "discover" ? "Discover Rooms" : "Rooms I Created"}
          </h1>
          <CategoryFilterPills
            categories={CATEGORY_FILTERS}
            counts={categoryCounts}
            active={categoryFilter}
            onChange={(filter) => setCategoryFilter(filter as CategoryFilter)}
          />
        </div>

        {viewMode === "discover" && categoryFilter === "All" ? (
          <div className={carouselEntrance.className} style={carouselEntrance.style}>
            <TrendingCarousel rooms={carouselRooms} />
          </div>
        ) : null}

        <div className="flex flex-col gap-10">
          <RoomSectionRow
            title="Recently Created"
            slug="recently-created"
            rooms={filteredRooms}
            emptyMessage={
              viewMode === "mine"
                ? "You haven't created any rooms yet."
                : "No rooms yet — be the first to create one."
            }
            joinedRoomIds={joinedRoomIdSet}
          />
          <RoomSectionRow
            title="Starting Soon"
            slug="starting-soon"
            rooms={startingSoonRooms}
            emptyMessage="Nothing starting soon yet."
          />
          <RoomSectionRow
            title="Mostly Crowded"
            slug="mostly-crowded"
            rooms={mostlyCrowdedRooms}
            emptyMessage="Nothing crowded yet."
          />
        </div>

        {scopedRooms.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <button
              type="button"
              onClick={openCreateRoom}
              className="relative flex flex-col items-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)]"
            >
              <span className="relative flex items-center justify-center gap-1 overflow-hidden rounded-[9px] px-8 py-2">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-[9px]"
                  style={{
                    backgroundImage:
                      "linear-gradient(180.64deg, rgb(228,221,221) 19.37%, rgb(220,220,220) 40.857%, rgb(216,213,213) 65.087%, rgb(209,209,209) 97.546%)",
                  }}
                />
                <span className="relative font-figtree text-[12px] font-medium text-black">
                  Create Room
                </span>
              </span>
            </button>
          </div>
        ) : null}
      </main>

      <DiscoverBottomBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
      />
    </div>
  );
}
