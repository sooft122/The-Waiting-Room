type MenuIconProps = {
  isOpen: boolean;
};

/**
 * Animated grid ⇄ close (X) glyph. Not sourced from Figma — the design only
 * specifies the grid icon — but requested as an interaction affordance so
 * the toggle button communicates open/close state.
 */
export default function MenuIcon({ isOpen }: MenuIconProps) {
  return (
    <span className="relative block size-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src="/icons/more-01.svg"
        className={`absolute inset-0 size-full transition-all duration-300 ease-out ${
          isOpen ? "rotate-45 opacity-0" : "rotate-0 opacity-100"
        }`}
      />
      <span
        aria-hidden
        className={`absolute inset-0 transition-all duration-300 ease-out ${
          isOpen ? "rotate-0 opacity-100" : "-rotate-45 opacity-0"
        }`}
      >
        <span className="absolute left-1/2 top-1/2 h-[1.5px] w-[16px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white" />
        <span className="absolute left-1/2 top-1/2 h-[1.5px] w-[16px] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-white" />
      </span>
    </span>
  );
}
