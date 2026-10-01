"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { initialsOf, tintFor } from "./format";
import { LockIcon } from "./icons";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Surfaces

/** The frosted panel everything sits on. */
export function Card({
  className,
  children,
  style,
}: {
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cx(
        "relative rounded-[22px] border border-white/[0.07] bg-[#1a1a1f]/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_48px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-medium text-white">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[13.5px] leading-[1.45] text-white/50">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-b from-[#f1f1f3] to-[#d6d6da] text-[#111114] shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-white hover:to-[#e2e2e6]",
  secondary:
    "border border-white/[0.09] bg-white/[0.05] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-white/[0.09] hover:text-white",
  ghost: "text-white/65 hover:bg-white/[0.07] hover:text-white",
  danger:
    "bg-gradient-to-b from-[#ff5a5f] to-[#e5383e] text-white shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.25)] hover:from-[#ff6b70] hover:to-[#ec4449]",
  dangerGhost: "text-[#ff8a8e] hover:bg-[#ff5a5f]/10 hover:text-[#ffa3a6]",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-[9px] px-2.5 text-[12.5px]",
  md: "h-9 gap-2 rounded-[10px] px-3.5 text-[13px]",
  lg: "h-10 gap-2 rounded-[11px] px-4 text-[14px]",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  /** Why this admin can't use it. The button shows a lock and does nothing,
   * and the reason is its tooltip (so it still has to take the pointer,
   * unlike a disabled one). */
  locked?: string | null | false;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    icon,
    loading,
    locked,
    className,
    children,
    disabled,
    type = "button",
    onClick,
    title,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-disabled={locked ? true : undefined}
      title={locked || title}
      onClick={locked ? (event) => event.preventDefault() : onClick}
      className={cx(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium outline-none transition-[background,color,box-shadow,transform,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-[#8fb2ff]/50 disabled:pointer-events-none disabled:opacity-45",
        locked ? "cursor-not-allowed opacity-45" : "active:scale-[0.98]",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size={14} /> : locked ? <LockIcon size={size === "lg" ? 15 : 13} /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md"; tone?: "default" | "danger" }
>(function IconButton({ label, size = "md", tone = "default", className, children, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-[9px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#8fb2ff]/50 disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "size-7" : "size-8",
        tone === "danger"
          ? "text-white/45 hover:bg-[#ff5a5f]/10 hover:text-[#ff8a8e]"
          : "text-white/50 hover:bg-white/[0.08] hover:text-white",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cx("animate-spin", className)}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        "inline-flex h-[20px] min-w-[20px] items-center justify-center gap-0.5 rounded-[6px] border border-white/[0.08] bg-white/[0.06] px-1.5 font-inter text-[11px] font-medium text-white/55",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

// ---------------------------------------------------------------------------
// Badges and avatars

export type BadgeTone = "neutral" | "green" | "amber" | "red" | "violet" | "blue";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-white/[0.07] text-white/65 ring-white/[0.06]",
  green: "bg-[#34d399]/[0.12] text-[#6ee7b7] ring-[#34d399]/20",
  amber: "bg-[#fbbf24]/[0.12] text-[#fcd34d] ring-[#fbbf24]/20",
  red: "bg-[#ff5a5f]/[0.12] text-[#ff9a9d] ring-[#ff5a5f]/20",
  violet: "bg-[#a78bfa]/[0.14] text-[#c4b5fd] ring-[#a78bfa]/20",
  blue: "bg-[#60a5fa]/[0.13] text-[#93c5fd] ring-[#60a5fa]/20",
};

export function Badge({
  tone = "neutral",
  dot,
  icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium ring-1 ring-inset",
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {icon}
      {children}
    </span>
  );
}

export function Avatar({
  name,
  image,
  size = 32,
  className,
}: {
  name: string;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  const style = { width: size, height: size };

  if (image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        src={image}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={style}
        className={cx("shrink-0 rounded-full object-cover ring-1 ring-white/10", className)}
      />
    );
  }
  const tint = tintFor(name);
  return (
    <span
      aria-hidden
      style={{
        ...style,
        background: `linear-gradient(150deg, ${tint}4d, ${tint}1f)`,
        color: tint,
        fontSize: Math.max(10, size * 0.36),
        boxShadow: `inset 0 0 0 1px ${tint}38`,
      }}
      className={cx("flex shrink-0 items-center justify-center rounded-full font-semibold", className)}
    >
      {initialsOf(name)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Segmented control — the raised pill slides between options.

export type SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
};

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  fullWidth,
  className,
  ariaLabel,
  locked,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Why this admin can't change it — it stays put, with this as the tooltip. */
  locked?: string | null | false;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  const measure = useCallback(() => {
    const button = buttonRefs.current.get(value);
    if (button) setPill({ left: button.offsetLeft, width: button.offsetWidth });
  }, [value]);

  useLayoutEffect(() => {
    measure();
  }, [measure, options]);

  useEffect(() => {
    // Only slide after the first placement — no sweep in from the left on mount.
    const id = requestAnimationFrame(() => setAnimate(true));
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return () => cancelAnimationFrame(id);
    const observer = new ResizeObserver(() => measure());
    observer.observe(track);
    return () => {
      cancelAnimationFrame(id);
      observer.disconnect();
    };
  }, [measure]);

  const heights = { sm: "h-8 text-[12.5px]", md: "h-9 text-[13px]", lg: "h-[46px] text-[14.5px]" };

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      aria-disabled={locked ? true : undefined}
      title={locked || undefined}
      className={cx(
        "relative flex rounded-[13px] bg-black/30 p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-white/[0.05]",
        fullWidth ? "w-full" : "w-fit max-w-full overflow-x-auto [scrollbar-width:none]",
        locked && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {pill ? (
        <span
          aria-hidden
          className={cx(
            "absolute bottom-[3px] top-[3px] rounded-[10px] bg-gradient-to-b from-[#4a4a52] to-[#3b3b42] shadow-[0_1px_3px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.09)] ring-1 ring-white/[0.06]",
            animate && "transition-[left,width] duration-200 ease-[cubic-bezier(.2,.8,.2,1)]",
          )}
          style={{ left: pill.left, width: pill.width }}
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) buttonRefs.current.set(option.value, node);
              else buttonRefs.current.delete(option.value);
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={locked ? undefined : () => onChange(option.value)}
            className={cx(
              "relative z-10 flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#8fb2ff]/40",
              heights[size],
              fullWidth && "flex-1",
              locked && "cursor-not-allowed",
              active ? "text-white" : locked ? "text-white/50" : "text-white/50 hover:text-white/80",
            )}
          >
            {option.icon}
            {option.label}
            {option.count !== undefined ? (
              <span className={cx("tabular-nums text-[11px]", active ? "text-white/55" : "text-white/35")}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form controls

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#8fb2ff]/50 disabled:opacity-50",
        checked ? "bg-[#e9e9ec]" : "bg-white/[0.14]",
      )}
    >
      <span
        className={cx(
          "absolute left-[3px] size-4 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)]",
          checked ? "translate-x-4 bg-[#16161a]" : "translate-x-0 bg-white/85",
        )}
      />
    </button>
  );
}

/** The box of a checkbox. Draw it inside the row that toggles it, so the
 * whole row is the click target. */
export function CheckMark({ state }: { state: "on" | "off" | "mixed" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "flex size-[18px] shrink-0 items-center justify-center rounded-[6px] transition-[background,box-shadow,color] duration-150",
        state === "off"
          ? "bg-white/[0.04] text-transparent shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.2)]"
          : "bg-[#ececef] text-[#16161a] shadow-[0_1px_2px_rgba(0,0,0,0.45)]",
      )}
    >
      {state === "mixed" ? (
        <span className="h-[2px] w-2 rounded-full bg-current" />
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
          <path
            d="m5 12.5 4.5 4.5L19 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

const FIELD_CONTROL =
  "w-full rounded-[11px] border border-white/[0.08] bg-white/[0.035] text-[13.5px] text-white placeholder:text-white/30 outline-none transition-[border-color,box-shadow,background] duration-150 hover:border-white/[0.13] focus:border-[#8fb2ff]/55 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(143,178,255,0.12)] disabled:opacity-50";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode }>(
  function TextInput({ className, leading, ...props }, ref) {
    if (leading) {
      return (
        <div className={cx("relative", className)}>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35">{leading}</span>
          <input ref={ref} className={cx(FIELD_CONTROL, "h-9 pl-9 pr-3")} {...props} />
        </div>
      );
    }
    return <input ref={ref} className={cx(FIELD_CONTROL, "h-9 px-3", className)} {...props} />;
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cx(FIELD_CONTROL, "min-h-[96px] resize-y px-3 py-2.5 leading-[1.5]", className)} {...props} />;
  },
);

/** The trigger half of a dropdown — looks like an input, opens a popover. */
export const SelectButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { leading?: ReactNode; placeholder?: boolean; open?: boolean }
>(function SelectButton({ leading, placeholder, open, className, children, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        FIELD_CONTROL,
        "flex h-9 items-center gap-2 px-3 text-left",
        open && "border-[#8fb2ff]/55 shadow-[0_0_0_4px_rgba(143,178,255,0.12)]",
        className,
      )}
      {...props}
    >
      {leading ? <span className="shrink-0 text-white/40">{leading}</span> : null}
      <span className={cx("min-w-0 flex-1 truncate", placeholder && "text-white/35")}>{children}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden className={cx("shrink-0 text-white/40 transition-transform", open && "rotate-180")}>
        <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
});

export function Field({
  label,
  hint,
  error,
  counter,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  counter?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-white/70">
          {label}
        </label>
        {counter ? <span className="text-[11.5px] tabular-nums text-white/35">{counter}</span> : null}
      </div>
      {children}
      {error ? (
        <p className="text-[12px] text-[#ff9a9d]">{error}</p>
      ) : hint ? (
        <p className="text-[12px] leading-[1.45] text-white/40">{hint}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlays

function usePortalReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

/** A panel anchored under (or, if there's no room, over) its trigger,
 * rendered at the top of the page so no scrolling container clips it. */
export function Popover({
  open,
  onClose,
  anchorRef,
  align = "start",
  children,
  className,
  matchWidth,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement>;
  align?: "start" | "end";
  children: ReactNode;
  className?: string;
  matchWidth?: boolean;
}) {
  const ready = usePortalReady();
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; minWidth?: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    function place() {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const { width, height } = panel.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let left = align === "end" ? anchor.right - width : anchor.left;
      left = Math.min(Math.max(8, left), Math.max(8, viewportWidth - width - 8));
      let top = anchor.bottom + 6;
      if (top + height > viewportHeight - 8 && anchor.top - 6 - height > 8) top = anchor.top - 6 - height;
      setPosition({ top, left, minWidth: matchWidth ? anchor.width : undefined });
    }
    place();
    const id = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, anchorRef, matchWidth]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element | null;
      if (!target) return;
      if (anchorRef.current?.contains(target)) return;
      // Clicks inside any popover (this one, or one opened from inside it) don't close it.
      if (target.closest("[data-admin-popover]")) return;
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      // Closes just this popover, not the dialog or drawer it sits in.
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !ready) return null;
  return createPortal(
    <div
      ref={panelRef}
      data-admin-popover=""
      style={{
        position: "fixed",
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        minWidth: position?.minWidth,
        visibility: position ? "visible" : "hidden",
      }}
      className={cx(
        "animate-admin-pop z-[90] rounded-[16px] border border-white/[0.09] bg-[#1b1b20]/95 p-1.5 font-inter text-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

export function MenuItem({
  icon,
  children,
  onSelect,
  tone = "default",
  disabled,
  hint,
  locked,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  hint?: ReactNode;
  /** Why this admin can't use it — shown with a lock, as the tooltip. */
  locked?: string | null | false;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-disabled={locked ? true : undefined}
      title={locked || undefined}
      onClick={locked ? undefined : onSelect}
      className={cx(
        "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] outline-none transition-colors disabled:pointer-events-none disabled:opacity-40",
        locked
          ? "cursor-not-allowed text-white/35"
          : tone === "danger"
            ? "text-[#ff8a8e] hover:bg-[#ff5a5f]/10 focus-visible:bg-[#ff5a5f]/10"
            : "text-white/85 hover:bg-white/[0.07] focus-visible:bg-white/[0.07]",
      )}
    >
      {icon ? (
        <span className={cx("shrink-0", locked ? "text-white/25" : tone === "danger" ? "text-[#ff8a8e]" : "text-white/45")}>
          {icon}
        </span>
      ) : null}
      <span className="flex-1">{children}</span>
      {locked ? (
        <span className="text-white/30">
          <LockIcon size={13} />
        </span>
      ) : hint ? (
        <span className="text-[11.5px] text-white/35">{hint}</span>
      ) : null}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-white/[0.07]" />;
}

/** "⋯" button with a menu of actions. */
export function ActionMenu({
  label = "More actions",
  children,
  align = "end",
}: {
  label?: string;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <IconButton
        ref={ref}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={open ? "bg-white/[0.08] text-white" : undefined}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <circle cx="5.5" cy="12" r="1.4" fill="currentColor" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
          <circle cx="18.5" cy="12" r="1.4" fill="currentColor" />
        </svg>
      </IconButton>
      <Popover open={open} onClose={close} anchorRef={ref} align={align} className="w-[220px]">
        <div role="menu" onClick={(event) => event.stopPropagation()}>
          {children(close)}
        </div>
      </Popover>
    </>
  );
}

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [active]);
}

// Dialogs and drawers can stack (a "discard changes?" prompt over the
// editor) — Escape only closes the one on top.
const overlayStack: number[] = [];
let overlaySequence = 0;

function useEscape(active: boolean, onEscape: () => void) {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const id = ++overlaySequence;
    overlayStack.push(id);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (overlayStack[overlayStack.length - 1] !== id) return;
      event.preventDefault();
      handler.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = overlayStack.indexOf(id);
      if (index !== -1) overlayStack.splice(index, 1);
    };
  }, [active]);
}

export function Dialog({
  open,
  onClose,
  children,
  className,
  labelledBy,
  width = 440,
  placement = "center",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
  width?: number;
  placement?: "center" | "top";
}) {
  const ready = usePortalReady();
  useScrollLock(open);
  useEscape(open, onClose);
  if (!open || !ready) return null;
  return createPortal(
    <div
      className={cx(
        "fixed inset-0 z-[80] flex justify-center overflow-y-auto p-4 font-inter",
        placement === "top" ? "items-start pt-[10vh]" : "items-center",
      )}
    >
      <div aria-hidden className="animate-admin-fade fixed inset-0 bg-black/60 backdrop-blur-[3px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{ maxWidth: width }}
        className={cx(
          "animate-admin-pop relative w-full rounded-[22px] border border-white/[0.09] bg-[#18181d]/95 text-white shadow-[0_40px_90px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** A panel that slides in from the right (full screen on phones). */
export function Drawer({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  const ready = usePortalReady();
  useScrollLock(open);
  useEscape(open, onClose);
  if (!open || !ready) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] font-inter">
      <div aria-hidden className="animate-admin-fade absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="animate-admin-drawer absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-white/[0.08] bg-[#131317]/[0.97] text-white shadow-[-40px_0_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:inset-y-2 sm:right-2 sm:rounded-[22px] sm:border"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Placeholders

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-[10px] bg-white/[0.06]", className)} />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
      {icon ? (
        <span className="flex size-11 items-center justify-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] text-white/45">
          {icon}
        </span>
      ) : null}
      <div>
        <p className="text-[14px] font-medium text-white/85">{title}</p>
        {body ? <p className="mx-auto mt-1 max-w-[340px] text-[13px] leading-[1.5] text-white/45">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}
