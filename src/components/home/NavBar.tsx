"use client";

import Link from "next/link";
import MenuIcon from "./MenuIcon";
import DropdownMenu from "./DropdownMenu";
import { useStaggerEntrance } from "@/hooks/useStaggerEntrance";

type NavBarProps = {
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onNavigate: () => void;
  anonId: string | null;
};

export default function NavBar({ isMenuOpen, onToggleMenu, onNavigate, anonId }: NavBarProps) {
  // Quick, minimal delay — the nav is chrome present on every page, not
  // page content, so it should feel like it's already there, just barely
  // settling in, rather than visibly lagging behind the rest of the page.
  const entrance = useStaggerEntrance(0, 0);
  const navEntrance = entrance();

  return (
    <div className="fixed inset-x-0 top-0 z-30 mx-auto w-full max-w-[1214px] px-5 pt-6 sm:px-8 sm:pt-8 lg:px-0 lg:pt-[33px]">
      <div className={`flex items-center justify-between ${navEntrance.className}`} style={navEntrance.style}>
        {/* Same coated-badge treatment as the menu button — the logo mark's
            own negative space (the gaps within its silhouette) would
            otherwise let whatever's behind the nav show through it. */}
        <Link
          href="/"
          aria-label="The Waiting Room home"
          className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-border"
          style={{ backgroundImage: "linear-gradient(180deg, #16171c, #101114)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="block h-[20px] w-auto" src="/icons/logo.svg" />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[-1px] rounded-[inherit] shadow-[inset_0px_1px_1px_0px_#404040]"
          />
        </Link>

        <div className="flex shrink-0 items-center gap-2.5">
          <span className="hidden font-inter text-[12px] font-medium text-white sm:inline">
            MENU
          </span>
          <button
            type="button"
            onClick={onToggleMenu}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-controls="home-dropdown-menu"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-border transition-transform active:scale-95"
            style={{ backgroundImage: "linear-gradient(180deg, #16171c, #101114)" }}
          >
            <MenuIcon isOpen={isMenuOpen} />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-[-1px] rounded-[inherit] shadow-[inset_0px_1px_1px_0px_#404040]"
            />
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <DropdownMenu
          className="right-5 top-[70px] sm:right-8 sm:top-[78px] lg:right-0 lg:top-[79px]"
          onNavigate={onNavigate}
          anonId={anonId}
        />
      ) : null}
    </div>
  );
}
