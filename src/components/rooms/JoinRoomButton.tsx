"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type JoinRoomButtonProps = {
  roomId: string;
  className: string;
  children: ReactNode;
  /** After joining: true navigates to the room page (used from the
   * carousel), false just refreshes the current page's server data (used
   * from the room page itself, so its own "Joined" state updates in place). */
  navigateAfterJoin?: boolean;
};

export default function JoinRoomButton({
  roomId,
  className,
  children,
  navigateAfterJoin = true,
}: JoinRoomButtonProps) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);

  async function handleClick() {
    setJoining(true);
    try {
      await fetch(`/api/rooms/${roomId}/join`, { method: "POST" });
    } finally {
      setJoining(false);
      if (navigateAfterJoin) {
        router.push(`/rooms/${roomId}`);
      } else {
        router.refresh();
      }
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={joining} className={className}>
      {children}
    </button>
  );
}
