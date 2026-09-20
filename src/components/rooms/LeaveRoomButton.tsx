"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type LeaveRoomButtonProps = {
  roomId: string;
  className: string;
  children: ReactNode;
};

export default function LeaveRoomButton({ roomId, className, children }: LeaveRoomButtonProps) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function handleClick() {
    setLeaving(true);
    try {
      await fetch(`/api/rooms/${roomId}/leave`, { method: "POST" });
    } finally {
      setLeaving(false);
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={leaving} className={className}>
      {children}
    </button>
  );
}
