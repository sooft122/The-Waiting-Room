import type { ReactNode } from "react";

type GhostButtonProps = {
  children: ReactNode;
  onClick?: () => void;
};

export default function GhostButton({ children, onClick }: GhostButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[10px] p-px drop-shadow-[0px_2px_2.7px_rgba(0,0,0,0.05)] transition-transform active:scale-[0.98]"
    >
      <span
        className="flex h-full w-full flex-1 items-center justify-center rounded-[6px] px-6 py-3.5 shadow-[0px_4px_27px_0px_rgba(0,0,0,0.18)]"
        style={{ backgroundImage: "linear-gradient(180deg, #313131, #232323)" }}
      >
        <span className="font-figtree text-[12px] font-medium text-subtle">
          {children}
        </span>
      </span>
    </button>
  );
}
