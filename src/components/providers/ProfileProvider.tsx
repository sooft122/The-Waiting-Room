"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useSession } from "next-auth/react";

export type ProfileData = {
  profile: { joinedAt: string };
  effectiveName: string;
  effectiveAvatarUrl: string | null;
  email: string | null;
  isAnonymous: boolean;
  anonId: string | null;
};

type ProfileContextValue = {
  profile: ProfileData | null;
  /** Merge a partial update into the shared profile immediately (optimistic —
   * called right after a successful PATCH), so every consumer — including
   * an already-open dropdown — reflects the change with no fetch delay. */
  applyUpdate: (updates: Partial<Pick<ProfileData, "effectiveName" | "effectiveAvatarUrl">>) => void;
  refresh: () => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

/**
 * Fetches /api/profile once, as soon as the app mounts (not per dropdown
 * open), and holds it for the whole session. This is what actually fixes
 * the "name flashes stale for a second" bug: previously each dropdown open
 * mounted a fresh component that had to fetch before it knew the current
 * name. Now the fetch already happened well before the user ever opens the
 * menu, and edits update this shared state directly instead of relying on
 * the next consumer to refetch.
 */
export default function ProfileProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((response) => response.json())
      .then((json: ProfileData) => setProfile(json))
      .catch(() => {
        // Leave the previous value in place — a transient failure shouldn't wipe known-good data.
      });
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    refresh();
  }, [status, refresh]);

  const applyUpdate = useCallback(
    (updates: Partial<Pick<ProfileData, "effectiveName" | "effectiveAvatarUrl">>) => {
      setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
    },
    [],
  );

  return (
    <ProfileContext.Provider value={{ profile, applyUpdate, refresh }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileContext() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfileContext must be used within ProfileProvider");
  }
  return ctx;
}
