import Link from "next/link";
import type { ReactNode } from "react";

type PrimaryButtonProps = {
  children: ReactNode;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  fullWidth?: boolean;
  type?: "button" | "submit";
  /** "large" is the home hero's call to action: 43px tall, 14px label, 16px icon. */
  size?: "default" | "large";
};

export default function PrimaryButton({
  children,
  icon,
  href,
  onClick,
  fullWidth,
  type = "button",
  size = "default",
}: PrimaryButtonProps) {
  const large = size === "large";
  const outerClass = `group relative flex shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[10px] bg-white p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)] transition-transform active:scale-[0.98] ${
    fullWidth ? "w-full" : ""
  } ${large ? "h-[43px] min-w-[171px]" : ""}`;

  const inner = (
    <span
      className={`relative flex w-full shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[9px] ${
        large ? "flex-1 px-4 py-2" : "px-6 py-2 sm:px-8"
      }`}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-[9px]"
        style={{
          backgroundImage:
            "linear-gradient(180.64deg, rgb(228,221,221) 19.37%, rgb(220,220,220) 40.857%, rgb(216,213,213) 65.087%, rgb(209,209,209) 97.546%)",
        }}
      />
      <span className={`relative font-figtree font-medium text-black ${large ? "text-[14px]" : "text-[12px]"}`}>
        {children}
      </span>
      {icon ? (
        <span className={`relative shrink-0 ${large ? "size-4" : "size-[14px]"}`}>{icon}</span>
      ) : null}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(28,28,28,0.05)]"
      />
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={outerClass}>
        {inner}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={outerClass}>
      {inner}
    </button>
  );
}
