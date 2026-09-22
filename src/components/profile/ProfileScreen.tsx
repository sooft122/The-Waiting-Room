"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import SiteHeader from "@/components/layout/SiteHeader";
import RoomCard from "@/components/rooms/RoomCard";
import GhostButton from "@/components/ui/GhostButton";
import { useProfileContext } from "@/components/providers/ProfileProvider";
import { useStaggerEntrance } from "@/hooks/useStaggerEntrance";
import type { Room } from "@/lib/rooms";
import ProfileAvatar from "./ProfileAvatar";
import EditProfileNameModal from "./EditProfileNameModal";

type ProfileScreenProps = {
  /** Rooms this identity has joined. */
  rooms: Room[];
  anonId: string | null;
};

function formatJoinedDate(iso: string): string {
  const date = new Date(iso);
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase();
  const year = date.getFullYear();
  return `${day} - ${month} - ${year}`;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <p className="text-white/60">{label}</p>
      <p className="text-white">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap rounded-[17px] px-3 py-1.5 font-satoshi text-[14px] transition-colors"
      style={
        active
          ? { backgroundImage: "linear-gradient(180deg, #a8a8a8, #d3d3d3)", color: "#000" }
          : { backgroundColor: "#1d1d1d", color: "#d0d0d0" }
      }
    >
      {children}
    </button>
  );
}

export default function ProfileScreen({ rooms, anonId }: ProfileScreenProps) {
  const { profile: data, applyUpdate } = useProfileContext();
  const [activeTab, setActiveTab] = useState<"active" | "ended">("active");
  const [editOpen, setEditOpen] = useState(false);

  const entrance = useStaggerEntrance(70, 45, 8);
  const titleEntrance = entrance();
  const headerEntrance = entrance();
  const tabsEntrance = entrance();

  const activeRooms = useMemo(
    () => rooms.filter((room) => new Date(room.date).getTime() > Date.now()),
    [rooms],
  );
  const endedRooms = useMemo(
    () => rooms.filter((room) => new Date(room.date).getTime() <= Date.now()),
    [rooms],
  );
  const visibleRooms = activeTab === "active" ? activeRooms : endedRooms;
  const cardEntrances = visibleRooms.map(() => entrance());

  async function handleHeaderAvatarChange(dataUrl: string) {
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      if (response.ok) {
        applyUpdate({ effectiveAvatarUrl: dataUrl });
      }
    } catch {
      // The header's quick-change is a shortcut; errors surface via the modal path instead.
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-bg">
      <SiteHeader anonId={anonId} />

      {/* pt compensates for the nav bar now being fixed (out of normal
          flow) instead of pushing this content down itself. */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1214px] flex-col gap-8 px-5 pb-24 pt-[104px] sm:px-8 sm:pt-[112px] lg:px-0 lg:pt-[125px]">
        <h1
          className={`font-satoshi text-[24px] leading-[1.08] text-white ${titleEntrance.className}`}
          style={titleEntrance.style}
        >
          My Profile
        </h1>

        {data ? (
          <>
            <div
              className={`flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center ${headerEntrance.className}`}
              style={headerEntrance.style}
            >
              <div className="flex items-center gap-[11px]">
                <ProfileAvatar
                  src={data.effectiveAvatarUrl}
                  anonymous={data.isAnonymous}
                  onChange={data.isAnonymous ? undefined : handleHeaderAvatarChange}
                />
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <p className="font-satoshi text-[18px] text-white">{data.effectiveName}</p>
                    {!data.isAnonymous ? (
                      <button
                        type="button"
                        onClick={() => setEditOpen(true)}
                        aria-label="Edit profile"
                        className="size-[18px] cursor-pointer"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="" className="size-full" src="/icons/edit-01.svg" />
                      </button>
                    ) : null}
                  </div>
                  {data.isAnonymous ? (
                    <GhostButton onClick={() => signIn("google")}>Save Your History</GhostButton>
                  ) : (
                    <p className="font-satoshi text-[14px] text-white/60">{data.email}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2.5 font-satoshi text-[14px]">
                <StatRow label="Time you Joined:" value={formatJoinedDate(data.profile.joinedAt)} />
                <StatRow label="Total Room Joined:" value={String(rooms.length)} />
                <StatRow label="Total Wait Time:" value="--" />
              </div>
            </div>

            <div className={`flex items-center gap-[7px] ${tabsEntrance.className}`} style={tabsEntrance.style}>
              <TabButton active={activeTab === "active"} onClick={() => setActiveTab("active")}>
                Active Rooms
              </TabButton>
              <TabButton active={activeTab === "ended"} onClick={() => setActiveTab("ended")}>
                Ended
              </TabButton>
            </div>

            {visibleRooms.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {visibleRooms.map((room, i) => (
                  <div key={room.id} className={cardEntrances[i].className} style={cardEntrances[i].style}>
                    <RoomCard room={room} joined />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5 py-24 text-center">
                <p className="max-w-[271px] font-satoshi text-[20px] text-white">
                  Oops, looks like you haven’t waited in any room :(
                </p>
                <Link href="/rooms" className="block">
                  <span className="flex h-8 w-[157px] items-center justify-center overflow-hidden rounded-[10px] p-px drop-shadow-[0px_2px_2.7px_rgba(0,0,0,0.05)]">
                    <span
                      className="flex h-full w-full items-center justify-center rounded-[6px] shadow-[0px_4px_27px_0px_rgba(0,0,0,0.18)]"
                      style={{ backgroundImage: "linear-gradient(180deg, #252628, #18191b)" }}
                    >
                      <span className="font-figtree text-[12px] font-medium text-subtle">
                        Discover Rooms
                      </span>
                    </span>
                  </span>
                </Link>
              </div>
            )}
          </>
        ) : null}
      </main>

      {editOpen && data && !data.isAnonymous ? (
        <EditProfileNameModal
          currentName={data.effectiveName}
          email={data.email ?? ""}
          avatarUrl={data.effectiveAvatarUrl}
          onClose={() => setEditOpen(false)}
          onSaved={(updates) => {
            // Only forward keys that actually changed — applyUpdate spreads
            // whatever it's given over the existing profile, so an explicit
            // `undefined` here would wipe the untouched field.
            if (updates.displayName !== undefined) {
              applyUpdate({ effectiveName: updates.displayName });
            }
            if (updates.avatarUrl !== undefined) {
              applyUpdate({ effectiveAvatarUrl: updates.avatarUrl });
            }
          }}
        />
      ) : null}
    </div>
  );
}
