"use client";

import { useState } from "react";
import { useRoomNotifications } from "@/hooks/useRoomNotifications";
import Switch from "@/components/ui/Switch";

type RoomNotificationToggleProps = {
  roomId: string;
  hasJoined: boolean;
  publicKey: string | null;
};

const LABEL = "Notify me of new messages";

// Same stroke style as the other interface icons (1.5px, rounded ends).
function BellIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <path d="M5.16 11.49c-.07 1.4.01 2.88-1.24 3.82A2.3 2.3 0 0 0 3 17.15C3 18.15 3.78 19 4.8 19h14.4c1.02 0 1.8-.85 1.8-1.85 0-.72-.34-1.4-.92-1.84-1.25-.94-1.17-2.42-1.24-3.82a6.85 6.85 0 0 0-13.68 0Z" />
      <path d="M10.5 3.13C10.5 3.95 11.17 5 12 5s1.5-1.05 1.5-1.87S12.83 2 12 2s-1.5.3-1.5 1.13Z" />
      <path d="M15 19a3 3 0 1 1-6 0" />
    </svg>
  );
}

/** The chat panel's "Notify me of new messages" switch. Renders nothing
 * where it can't work (not joined, not set up, no web push in the browser). */
export default function RoomNotificationToggle({ roomId, hasJoined, publicKey }: RoomNotificationToggleProps) {
  const { status, pending, error, toggle } = useRoomNotifications({ roomId, hasJoined, publicKey });
  const [showHomeScreenHint, setShowHomeScreenHint] = useState(false);

  if (status === "unavailable") return null;

  const on = status === "on";
  const disabled = pending || status === "checking" || status === "blocked";

  return (
    <div className="flex flex-col gap-1.5 border-b border-white/10 pb-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-satoshi text-[12px] text-white/70">
          <BellIcon />
          {LABEL}
        </span>
        <Switch
          checked={on}
          label={LABEL}
          disabled={disabled}
          onClick={
            status === "needs-home-screen" ? () => setShowHomeScreenHint((current) => !current) : toggle
          }
        />
      </div>

      {status === "blocked" ? (
        <p className="font-inter text-[11px] text-white/40">
          Notifications are blocked for this site. Allow them in your browser&apos;s settings to turn this on.
        </p>
      ) : null}
      {status === "needs-home-screen" && showHomeScreenHint ? (
        <p className="font-inter text-[11px] text-white/60">
          On iPhone and iPad, add this site to your Home Screen first (Share, then Add to Home Screen),
          open it from there, and turn this on.
        </p>
      ) : null}
      {error ? <p className="font-inter text-[11px] text-red-400">{error}</p> : null}
    </div>
  );
}
