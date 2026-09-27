"use client";

import type { CSSProperties } from "react";
import Switch from "@/components/ui/Switch";

type RoomPrivacyToggleProps = {
  /** Keeps the ids unique between the Create and Edit forms. */
  idPrefix: string;
  isPrivate: boolean;
  onChange: (isPrivate: boolean) => void;
  className?: string;
  style?: CSSProperties;
};

/** The room forms' "Set room to private" switch, styled like their inputs. */
export default function RoomPrivacyToggle({
  idPrefix,
  isPrivate,
  onChange,
  className = "",
  style,
}: RoomPrivacyToggleProps) {
  const switchId = `${idPrefix}-private`;
  const labelId = `${switchId}-label`;
  const hintId = `${switchId}-hint`;

  return (
    <div
      className={`flex w-full items-center justify-between gap-3 rounded-[8px] border border-[#2b2d30] bg-[#1b1c21] px-2.5 py-2.5 ${className}`}
      style={style}
    >
      {/* A label for the switch, so tapping the text flips it too. */}
      <label htmlFor={switchId} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1">
        <span id={labelId} className="font-satoshi text-[12px] text-white">
          Set room to private
        </span>
        <span id={hintId} className="font-satoshi text-[11px] leading-[1.3] text-white/50">
          Only users you share your link to would be able to join this room.
        </span>
      </label>
      <Switch
        id={switchId}
        checked={isPrivate}
        onClick={() => onChange(!isPrivate)}
        labelledBy={labelId}
        describedBy={hintId}
      />
    </div>
  );
}
