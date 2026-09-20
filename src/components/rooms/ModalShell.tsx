"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

type ModalShellProps = {
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
};

export default function ModalShell({ onClose, labelledBy, children }: ModalShellProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-5">
      <div
        aria-hidden
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="animate-dropdown-in relative z-10 max-h-[90vh] w-full max-w-[446px] overflow-y-auto rounded-[10px] border border-border p-5"
        style={{ backgroundImage: "linear-gradient(180deg, #16171c, #101114)" }}
      >
        {children}
      </div>
    </div>
  );
}
