"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SiteHeader from "@/components/layout/SiteHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { ROOM_CATEGORIES } from "@/lib/rooms";
import type { Room } from "@/lib/rooms";
import { useStaggerEntrance } from "@/hooks/useStaggerEntrance";
import CategoryFilterPills from "./CategoryFilterPills";
import DiscoverBottomBar from "./DiscoverBottomBar";
import RoomCard from "./RoomCard";

const CATEGORY_FILTERS = ["All", ...ROOM_CATEGORIES] as const;
type CategoryFilter = (typeof CATEGORY_FILTERS)[number];
type ViewMode = "discover" | "mine";

type RoomSectionAllScreenProps = {
  title: string;
  rooms: Room[];
  emptyMessage: string;
  anonId: string | null;
  joinedRoomIds: string[];
};

export default function RoomSectionAllScreen({
  title,
  rooms,
  emptyMessage,
  anonId,
  joinedRoomIds,
}: RoomSectionAllScreenProps) {
  const joinedRoomIdSet = useMemo(() => new Set(joinedRoomIds), [joinedRoomIds]);
  const router = useRouter();
  const { data: session } = useSession();

  const entrance = useStaggerEntrance(70, 45, 8);
  const breadcrumbEntrance = entrance();
  const headerEntrance = entrance();

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

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  const cardEntrances = filteredRooms.map(() => entrance());

  return (
    <div className="relative min-h-screen w-full bg-bg">
      <SiteHeader anonId={anonId} />

      {/* pt compensates for the nav bar now being fixed (out of normal
          flow) instead of pushing this content down itself. */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1214px] flex-col gap-7 px-5 pb-48 pt-[104px] sm:px-8 sm:pt-[112px] lg:px-0 lg:pt-[125px]">
        <Breadcrumbs
          items={[{ label: "Discover Rooms", href: "/rooms" }, { label: title }]}
          className={breadcrumbEntrance.className}
          style={breadcrumbEntrance.style}
        />

        <div className={`flex flex-col gap-3 ${headerEntrance.className}`} style={headerEntrance.style}>
          <h1 className="font-satoshi text-[24px] leading-[1.08] text-white">{title}</h1>
          <CategoryFilterPills
            categories={CATEGORY_FILTERS}
            counts={categoryCounts}
            active={categoryFilter}
            onChange={(category) => setCategoryFilter(category as CategoryFilter)}
          />
        </div>

        {filteredRooms.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {filteredRooms.map((room, i) => (
              <div key={room.id} className={cardEntrances[i].className} style={cardEntrances[i].style}>
                <RoomCard room={room} joined={joinedRoomIdSet.has(room.id)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center rounded-[20px] bg-white/[0.02] px-6 text-center">
            <p className="font-inter text-[13px] text-white/40">{emptyMessage}</p>
          </div>
        )}
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
