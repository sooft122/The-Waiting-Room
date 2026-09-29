"use client";

import { useEffect, useState } from "react";
import ModalShell from "@/components/rooms/ModalShell";
import { useProfileContext } from "./ProfileProvider";

const DISMISSED_STORAGE_KEY = "waiting-room:suspension-notice-dismissed";

/** Tells a suspended visitor why joining, chatting and creating stopped
 * working — once per browser session, including the moment it happens
 * (their profile is re-read as soon as the admin makes the change). */
export default function SuspendedNotice() {
  const { profile } = useProfileContext();
  const suspended = profile?.suspended === true;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!suspended) {
      setOpen(false);
      try {
        window.sessionStorage.removeItem(DISMISSED_STORAGE_KEY);
      } catch {
        // Storage unavailable — the notice may just show again next time.
      }
      return;
    }
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(DISMISSED_STORAGE_KEY) === "1";
    } catch {
      // Storage unavailable — show it.
    }
    if (!dismissed) setOpen(true);
  }, [suspended]);

  if (!open) return null;

  function dismiss() {
    setOpen(false);
    try {
      window.sessionStorage.setItem(DISMISSED_STORAGE_KEY, "1");
    } catch {
      // Non-fatal.
    }
  }

  return (
    <ModalShell onClose={dismiss} labelledBy="suspended-notice-title">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-red-500/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="size-5 invert" src="/icons/lock-01.svg" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 id="suspended-notice-title" className="font-satoshi text-[18px] text-white">
            Your account is suspended
          </h2>
          <p className="mx-auto max-w-[320px] font-inter text-[13px] leading-[1.5] text-white/60">
            An admin has suspended your account. You can still look around, but joining rooms,
            chatting and creating rooms are turned off.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="mt-1 h-9 w-full max-w-[200px] rounded-[10px] border border-border bg-[#1b1c21] font-figtree text-[12px] font-medium text-white transition-colors hover:bg-[#232429]"
        >
          Okay
        </button>
      </div>
    </ModalShell>
  );
}
