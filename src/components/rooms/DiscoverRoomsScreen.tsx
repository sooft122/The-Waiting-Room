"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SiteHeader from "@/components/layout/SiteHeader";
import { ROOM_CATEGORIES } from "@/lib/rooms";
import type { Room } from "@/lib/rooms";
import { useRoomModal } from "./RoomModalProvider";
import TrendingCarousel from "./TrendingCarousel";
import RoomSectionRow from "./RoomSectionRow";

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

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [viewMode, setViewMode] = useState<ViewMode>("discover");
  const [searchQuery, setSearchQuery] = useState("");

  const myIdentity = session?.user?.email ?? (anonId ? `anon:${anonId}` : null);

  const scopedRooms = useMemo(() => {
    if (viewMode === "discover") return rooms;
    if (!myIdentity) return [];
    return rooms.filter((room) => room.createdBy === myIdentity);
  }, [rooms, viewMode, myIdentity]);

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

  // No real "trending" signal yet (no join/view counts to rank by) — for now
  // the carousel just features whichever rooms exist, oldest of the batch
  // first, capped at 4. Swap this selection for real trending data later.
  const carouselRooms = useMemo(() => [...filteredRooms].reverse().slice(0, 4), [filteredRooms]);

  // "Starting Soon" and "Mostly Crowded" need signals we don't track yet
  // (a soon-to-start window, and live participant counts) — deliberately
  // left empty for now rather than faked.
  const startingSoonRooms: Room[] = [];
  const mostlyCrowdedRooms: Room[] = [];

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

      <main className="relative z-10 mx-auto flex w-full max-w-[1214px] flex-col gap-10 px-5 pb-48 pt-10 sm:px-8 lg:px-0 lg:pt-[52px]">
        <div className="flex flex-col gap-3">
          <h1 className="font-satoshi text-[24px] leading-[1.08] text-white">
            {viewMode === "discover" ? "Discover Rooms" : "Rooms I Created"}
          </h1>
          <div className="flex flex-wrap items-center gap-[7px]">
            {CATEGORY_FILTERS.map((filter) => {
              const isActive = filter === categoryFilter;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setCategoryFilter(filter)}
                  className={`shrink-0 whitespace-nowrap rounded-[17px] px-3 py-1.5 font-satoshi text-[14px] opacity-65 transition-colors ${
                    isActive ? "text-black" : "bg-[#1d1d1d] text-[#d0d0d0] hover:bg-[#262626]"
                  }`}
                  style={
                    isActive
                      ? { backgroundImage: "linear-gradient(180deg, #a8a8a8, #d3d3d3)" }
                      : undefined
                  }
                >
                  {filter} ({categoryCounts[filter]})
                </button>
              );
            })}
          </div>
        </div>

        {viewMode === "discover" && categoryFilter === "All" ? (
          <TrendingCarousel rooms={carouselRooms} />
        ) : null}

        <div className="flex flex-col gap-10">
          <RoomSectionRow
            title="Recently Created"
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
            rooms={startingSoonRooms}
            emptyMessage="Nothing starting soon yet."
          />
          <RoomSectionRow
            title="Mostly Crowded"
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

      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[206px]"
        style={{ backgroundImage: "linear-gradient(to top, #0c0d10, rgba(12,13,16,0))" }}
      />

      <div className="fixed inset-x-0 bottom-7 z-20 flex flex-col items-center gap-5 px-5">
        <div className="flex w-full max-w-[494px] flex-col items-center gap-5">
          <div className="flex items-center gap-[7px]">
            <button
              type="button"
              onClick={() => setViewMode("discover")}
              className="rounded-[30px] px-3.5 py-2.5 font-satoshi text-[14px] opacity-65 transition-colors"
              style={
                viewMode === "discover"
                  ? { backgroundImage: "linear-gradient(180deg, #a8a8a8, #d3d3d3)", color: "#000" }
                  : { backgroundColor: "#1d1d1d", color: "#d0d0d0" }
              }
            >
              Discover
            </button>
            <button
              type="button"
              onClick={() => setViewMode("mine")}
              className="rounded-[30px] px-3.5 py-2.5 font-satoshi text-[14px] opacity-65 transition-colors"
              style={
                viewMode === "mine"
                  ? { backgroundImage: "linear-gradient(180deg, #a8a8a8, #d3d3d3)", color: "#000" }
                  : { backgroundColor: "#1d1d1d", color: "#d0d0d0" }
              }
            >
              Rooms i Created
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex w-full items-center gap-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search For Rooms..."
              className="h-12 flex-1 rounded-[10px] border border-[rgba(227,221,221,0.4)] bg-[#202021] px-3.5 font-figtree text-[14px] text-white placeholder:text-white/60 focus:outline-none"
            />
            <button
              type="submit"
              className="relative flex h-12 w-[100px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)]"
            >
              <span className="relative flex size-full items-center justify-center gap-1 overflow-hidden rounded-[9px]">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-[9px]"
                  style={{
                    backgroundImage:
                      "linear-gradient(181.39deg, rgb(228,221,221) 19.37%, rgb(220,220,220) 40.857%, rgb(216,213,213) 65.087%, rgb(209,209,209) 97.546%)",
                  }}
                />
                <span className="relative font-figtree text-[14px] font-medium text-black">
                  Search
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="relative size-4" src="/icons/search-solid.svg" />
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
