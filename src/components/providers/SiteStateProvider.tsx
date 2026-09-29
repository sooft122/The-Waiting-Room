"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SITE_STATE_POLL_MS, type SiteState } from "@/lib/siteStateShared";
import { useProfileContext } from "./ProfileProvider";

const SiteStateContext = createContext<SiteState | null>(null);

/**
 * Keeps every open page in step with the admin dashboard. While the tab is
 * visible it checks /api/site every few seconds (answered by the CDN, so
 * it's cheap however many pages are open):
 *  - settings like the room-creation lock apply the moment they arrive;
 *  - when rooms changed, the page quietly re-fetches its server data in
 *    place (router.refresh — no reload, scroll and typing are kept);
 *  - when an account changed, the viewer's own profile is re-read, so a new
 *    name or a suspension shows up for them right away.
 * Seeded from the server render, so the first paint already matches.
 */
export default function SiteStateProvider({ initial, children }: { initial: SiteState; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { refresh: refreshProfile } = useProfileContext();
  const [state, setState] = useState(initial);
  const seen = useRef({ content: initial.contentVersion, people: initial.peopleVersion });

  // A fresh server render (after a refresh or navigation) carries the
  // latest state too — adopt it if it's newer than what's been seen.
  useEffect(() => {
    if (initial.contentVersion < seen.current.content || initial.peopleVersion < seen.current.people) return;
    seen.current = { content: initial.contentVersion, people: initial.peopleVersion };
    setState(initial);
  }, [initial]);

  // The dashboard keeps its own data current.
  const isAdminPage = pathname?.startsWith("/admin") ?? false;

  useEffect(() => {
    if (isAdminPage) return;
    let cancelled = false;

    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/site");
        if (!response.ok) return;
        const next = (await response.json()) as SiteState;
        if (cancelled || typeof next?.contentVersion !== "number") return;
        setState(next);
        if (next.contentVersion > seen.current.content) {
          seen.current.content = next.contentVersion;
          router.refresh();
        }
        if (next.peopleVersion > seen.current.people) {
          seen.current.people = next.peopleVersion;
          refreshProfile();
          router.refresh();
        }
      } catch {
        // Offline for a moment — the next check catches up.
      }
    }

    const id = setInterval(check, SITE_STATE_POLL_MS);
    // Catch up straight away when someone comes back to the tab.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAdminPage, router, refreshProfile]);

  return <SiteStateContext.Provider value={state}>{children}</SiteStateContext.Provider>;
}

export function useSiteState(): SiteState {
  const ctx = useContext(SiteStateContext);
  if (!ctx) throw new Error("useSiteState must be used within SiteStateProvider");
  return ctx;
}
