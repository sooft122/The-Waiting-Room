import Link from "next/link";
import MenuIcon from "./MenuIcon";
import DropdownMenu from "./DropdownMenu";

type NavBarProps = {
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onNavigate: () => void;
  anonId: string | null;
};

export default function NavBar({ isMenuOpen, onToggleMenu, onNavigate, anonId }: NavBarProps) {
  return (
    <div className="relative z-30 mx-auto w-full max-w-[1214px] px-5 pt-6 sm:px-8 sm:pt-8 lg:px-0 lg:pt-[33px]">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="The Waiting Room home" className="relative size-[30px] shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="block size-full" src="/icons/logo.svg" />
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
