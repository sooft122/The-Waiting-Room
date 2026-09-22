"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import PrimaryButton from "../ui/PrimaryButton";
import GhostButton from "../ui/GhostButton";
import { useRoomModal } from "../rooms/RoomModalProvider";
import { useProfileContext } from "@/components/providers/ProfileProvider";
import { useStaggerEntrance } from "@/hooks/useStaggerEntrance";

const NAV_ITEMS = [
  { label: "HOME", href: "/", icon: "/icons/home-02.svg" },
  { label: "SEARCH", href: "/search", icon: "/icons/search-01.svg" },
  { label: "ROOMS", href: "/rooms", icon: "/icons/map-pin-house.svg" },
  { label: "ARCHIVE", href: "/archive", icon: "/icons/archive.svg" },
];

// Base delay lets the panel shell (animate-dropdown-in, 160ms) settle first.
const STAGGER_BASE_MS = 70;
const STAGGER_STEP_MS = 35;

type DropdownMenuProps = {
  className?: string;
  anonId?: string | null;
  onNavigate?: () => void;
};

export default function DropdownMenu({
  className = "",
  anonId = null,
  onNavigate,
}: DropdownMenuProps) {
  const { data: session, status } = useSession();
  const { openCreateRoom } = useRoomModal();
  const { profile } = useProfileContext();
  const isSignedIn = status === "authenticated";
  const anonName = anonId ? `Anonymous #${anonId}` : "Anonymous";
  // ProfileProvider fetches once at app mount, well before the dropdown is
  // ever opened, so `profile` is normally already populated here. This
  // fallback only covers the rare case of opening the menu in the first
  // instant of page load — and even then, it prefers the session's own name
  // over the anonymous placeholder for a signed-in account, since anonId
  // stays set in the cookie even after signing in.
  const fallbackName = isSignedIn ? session?.user?.name ?? anonName : anonName;
  const displayName = profile?.effectiveName ?? fallbackName;

  const entrance = useStaggerEntrance(STAGGER_BASE_MS, STAGGER_STEP_MS);
  const profileEntrance = entrance();
  const navItemEntrances = NAV_ITEMS.map(() => entrance());
  const actionsEntrance = entrance();

  return (
    <div
      id="home-dropdown-menu"
      role="menu"
      aria-label="Main menu"
      className={`animate-dropdown-in absolute z-40 w-[273px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-[8px] border border-border ${className}`}
      style={{ backgroundImage: "linear-gradient(180deg, #16171c, #101114)" }}
    >
      <Link
        href="/profile"
        onClick={onNavigate}
        role="menuitem"
        className={`flex items-center justify-between gap-4 px-5 pb-4 pt-5 ${profileEntrance.className}`}
        style={profileEntrance.style}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="relative size-7 shrink-0 overflow-hidden rounded-full bg-[#232323]">
            {profile?.effectiveAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="absolute inset-0 size-full object-cover"
                src={profile.effectiveAvatarUrl}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="absolute left-1/4 right-[25.9%] top-[19.64%] bottom-[20.21%] block size-auto max-w-none"
                src="/icons/logo-avatar.svg"
              />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col justify-center leading-normal">
            <span className="mb-[-1px] font-satoshi text-[10px] text-muted">Profile</span>
            <span className="truncate font-satoshi text-[12px] font-medium text-white">
              {displayName}
            </span>
          </span>
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="size-5 shrink-0" src="/icons/arrow-right-01.svg" />
      </Link>

      <div className="h-px w-full bg-[rgba(255,255,255,0.08)]" />

      <nav className="nav-hierarchy flex flex-col gap-3 px-5 py-[18px]">
        {NAV_ITEMS.map((item, i) => (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            role="menuitem"
            className={`flex items-center justify-between text-white ${navItemEntrances[i].className}`}
            style={navItemEntrances[i].style}
          >
            <span className="font-satoshi text-[20px]">{item.label}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className="size-5 shrink-0" src={item.icon} />
          </Link>
        ))}
      </nav>

      <div className="h-px w-full bg-[rgba(255,255,255,0.08)]" />

      <div className={`flex flex-col gap-1.5 px-5 py-5 ${actionsEntrance.className}`} style={actionsEntrance.style}>
        <PrimaryButton
          onClick={() => {
            onNavigate?.();
            openCreateRoom();
          }}
          fullWidth
          icon={
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="size-full" src="/icons/add-01.svg" />
          }
        >
          Create Room
        </PrimaryButton>
        {isSignedIn ? (
          <GhostButton onClick={() => signOut()}>Sign Out</GhostButton>
        ) : (
          <GhostButton onClick={() => signIn("google")}>Save Your History</GhostButton>
        )}
      </div>
    </div>
  );
}
