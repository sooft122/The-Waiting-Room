"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import {
  deniedMessage,
  describeAccess,
  hasPermission,
  type AdminAccess,
  type AdminPermission,
  type OwnerOnly,
} from "@/lib/admin/permissions";
import type { AdminMe, AdminPerson, AdminRoom, AdminSnapshot } from "@/lib/admin/types";
import AccessDialog from "./AccessDialog";
import {
  AdminApiError,
  AdminContextProvider,
  createAdminCall,
  type AccessTarget,
  type AdminTab,
} from "./AdminContext";
import ActivityView from "./ActivityView";
import AdminGate from "./AdminGate";
import CommandPalette from "./CommandPalette";
import { isLive } from "./format";
import { CrownIcon, ExternalIcon, LockIcon, LogOutIcon, SearchIcon, ShieldIcon } from "./icons";
import OverviewView from "./OverviewView";
import PeopleView from "./PeopleView";
import RoomEditor from "./RoomEditor";
import RoomsView from "./RoomsView";
import SettingsView from "./SettingsView";
import { Avatar, Badge, Button, Kbd, MenuItem, MenuSeparator, Popover, cx } from "./ui";
import { useLatest } from "./useLatest";

const TABS: { value: AdminTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "rooms", label: "Rooms" },
  { value: "people", label: "People" },
  { value: "activity", label: "Activity" },
  { value: "settings", label: "Settings" },
];

const TAB_SUBTITLES: Record<AdminTab, string> = {
  overview: "Everything on The Waiting Room at a glance. Your changes reach every open page within seconds.",
  rooms: "Every room — public, private, ended and in the trash. Open a row to manage its people and chat.",
  people: "Everyone who's signed in with Google or visited anonymously, and what they've been up to.",
  activity: "Every change made from this dashboard. Almost anything can be undone.",
  settings: "Site-wide switches, and who can get in here.",
};

// How often the open dashboard re-reads everything while you're looking at it
// (never while the tab is in the background). Your own changes show up
// straight away regardless; these just pick up what visitors are doing.
const SNAPSHOT_POLL_MS = 10_000;
const PEOPLE_POLL_MS = 60_000;

type FocusTarget = { tab: "rooms"; roomId: string } | { tab: "people"; identity: string };

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
}

export default function AdminApp({
  adminKey,
  admin,
}: {
  adminKey: string;
  admin: AdminAccess & { email: string; name: string; image: string | null };
}) {
  const call = useMemo(() => createAdminCall(adminKey), [adminKey]);
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [people, setPeople] = useState<AdminPerson[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connection, setConnection] = useState<"live" | "offline">("live");
  // Signed out, or no longer an admin — checked on every refresh, so someone
  // the owner removes is shown out within seconds.
  const [accessEnded, setAccessEnded] = useState(false);
  const [accessTarget, setAccessTarget] = useState<AccessTarget | null>(null);
  const [tab, setTabState] = useState<AdminTab>("overview");
  const [now, setNow] = useState(() => Date.now());
  const [editorTarget, setEditorTarget] = useState<AdminRoom | "new" | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const hasSnapshot = useRef(false);

  const fetchSnapshot = useCallback(() => call<AdminSnapshot>("snapshot"), [call]);
  const applySnapshot = useCallback((next: AdminSnapshot) => {
    hasSnapshot.current = true;
    setSnapshot(next);
    setConnection("live");
    setLoadError(null);
    setAccessEnded(false);
  }, []);
  const snapshotFailed = useCallback((error: unknown) => {
    if (error instanceof AdminApiError && error.status === 404) {
      setAccessEnded(true);
      return;
    }
    setConnection("offline");
    if (!hasSnapshot.current) setLoadError(error instanceof Error ? error.message : "Couldn't load the dashboard.");
  }, []);
  const loadSnapshot = useLatest(fetchSnapshot, applySnapshot, snapshotFailed);
  const refresh = useCallback(() => loadSnapshot(), [loadSnapshot]);

  // A failed people refresh keeps the list as it was — the next one tries again.
  const fetchPeople = useCallback(() => call<AdminPerson[]>("people.list"), [call]);
  const loadPeople = useLatest(fetchPeople, setPeople);
  const refreshPeople = useCallback(() => loadPeople(), [loadPeople]);

  // First load, then keep everything current while the tab is visible.
  useEffect(() => {
    void loadSnapshot();
    void loadPeople();
    const snapshotTimer = setInterval(() => {
      if (document.visibilityState === "visible") void loadSnapshot(true);
    }, SNAPSHOT_POLL_MS);
    const peopleTimer = setInterval(() => {
      if (document.visibilityState === "visible") void loadPeople(true);
    }, PEOPLE_POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 10_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        void loadSnapshot(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(snapshotTimer);
      clearInterval(peopleTimer);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadSnapshot, loadPeople]);

  // The open tab lives in the URL's #fragment, so reloading keeps your place.
  useLayoutEffect(() => {
    const fromHash = window.location.hash.slice(1) as AdminTab;
    if (TABS.some((item) => item.value === fromHash)) setTabState(fromHash);
  }, []);

  const setTab = useCallback((next: AdminTab) => {
    setTabState(next);
    window.history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const focusOn = useCallback(
    (target: FocusTarget) => {
      setTab(target.tab);
      setFocus(target);
    },
    [setTab],
  );
  const clearFocus = useCallback(() => setFocus(null), []);
  const openEditor = useCallback((room: AdminRoom | "new") => setEditorTarget(room), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openAccess = useCallback((target: AccessTarget) => setAccessTarget(target), []);

  // Who's using the dashboard, from the latest snapshot once there is one.
  const latestMe = snapshot?.me;
  const me = useMemo<AdminMe>(
    () => latestMe ?? { email: admin.email, role: admin.role, permissions: admin.permissions },
    [latestMe, admin.email, admin.role, admin.permissions],
  );
  const can = useCallback((permission: AdminPermission | OwnerOnly) => hasPermission(me, permission), [me]);
  const deny = useCallback(
    (permission: AdminPermission | OwnerOnly) => (hasPermission(me, permission) ? null : deniedMessage(permission)),
    [me],
  );
  const canCreateRooms = useRef(can("rooms.create"));
  canCreateRooms.current = can("rooms.create");

  // ⌘K / Ctrl+K or "/" searches; "n" starts a new room.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (event.key === "/") {
        event.preventDefault();
        setPaletteOpen(true);
      } else if (event.key === "n" && canCreateRooms.current) {
        event.preventDefault();
        setEditorTarget("new");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const counts = useMemo(() => {
    if (!snapshot) return {} as Partial<Record<AdminTab, number>>;
    return {
      rooms: snapshot.rooms.filter((room) => isLive(room, now)).length,
      people: people?.filter((person) => person.kind === "google").length,
    } as Partial<Record<AdminTab, number>>;
  }, [snapshot, people, now]);

  // Sliding underline under the active tab.
  const tabRefs = useRef(new Map<AdminTab, HTMLButtonElement>());
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const node = tabRefs.current.get(tab);
      if (node) setUnderline({ left: node.offsetLeft, width: node.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [tab, counts.rooms, counts.people]);

  const locked = snapshot?.site.roomCreation.locked ?? false;

  if (accessEnded) return <AdminGate state="ended" />;

  return (
    <AdminContextProvider
      value={{
        call,
        admin,
        me,
        can,
        deny,
        openAccess,
        adminKey,
        snapshot,
        people,
        now,
        tab,
        setTab,
        refresh,
        refreshPeople,
        openEditor,
        openPalette,
        focus,
        focusOn,
        clearFocus,
      }}
    >
      <div className="relative min-h-screen overflow-x-clip bg-[#0a0a0c] font-inter text-white antialiased">
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-48 left-[6%] h-[460px] w-[620px] rounded-full bg-[#4453d6]/[0.11] blur-[130px]" />
          <div className="absolute right-[-12%] top-[28%] h-[420px] w-[520px] rounded-full bg-[#a14fd8]/[0.075] blur-[130px]" />
          <div className="absolute bottom-[-18%] left-[28%] h-[360px] w-[680px] rounded-full bg-white/[0.035] blur-[110px]" />
        </div>

        <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0c]/72 backdrop-blur-xl">
          <div className="mx-auto flex h-[60px] max-w-[1240px] items-center gap-3 px-4 sm:px-6">
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-[9px] border border-white/[0.1] bg-gradient-to-b from-[#1c1d22] to-[#111215] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" src="/icons/logo.svg" className="h-4 w-auto" />
              </span>
              <span className="hidden text-[14px] font-semibold tracking-[-0.01em] md:inline">The Waiting Room</span>
              <Badge tone="violet">Admin</Badge>
            </div>

            <button
              type="button"
              onClick={openPalette}
              className="mx-auto flex h-9 w-full max-w-[440px] items-center gap-2.5 rounded-[11px] border border-white/[0.08] bg-white/[0.04] px-3 text-[13px] text-white/40 transition-colors hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/60"
            >
              <SearchIcon size={15} />
              <span className="min-w-0 flex-1 truncate text-left">
                <span className="sm:hidden">Search</span>
                <span className="hidden sm:inline">Search rooms, people, actions…</span>
              </span>
              <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
            </button>

            <span
              className={cx(
                "hidden shrink-0 items-center gap-2 rounded-full px-2.5 py-1 text-[12px] font-medium sm:flex",
                connection === "live" ? "text-[#6ee7b7]" : "text-[#fcd34d]",
              )}
              title={connection === "live" ? "Up to date — refreshing every few seconds" : "Reconnecting…"}
            >
              <span
                className={cx(
                  "size-2 rounded-full",
                  connection === "live" ? "admin-live-dot bg-[#34d399]" : "bg-[#fbbf24]",
                )}
              />
              {connection === "live" ? "Live" : "Reconnecting"}
            </span>

            <button
              ref={menuRef}
              type="button"
              aria-label="Account"
              onClick={() => setMenuOpen((current) => !current)}
              className="shrink-0 rounded-full outline-none ring-offset-2 ring-offset-[#0a0a0c] transition-shadow focus-visible:ring-2 focus-visible:ring-[#8fb2ff]/50"
            >
              <Avatar name={admin.name} image={admin.image} size={32} />
            </button>
            <Popover open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={menuRef} align="end" className="w-[240px]">
              <div className="px-2.5 pb-2 pt-1.5">
                <p className="truncate text-[13px] font-medium">{admin.name}</p>
                <p className="truncate text-[12px] text-white/40">{admin.email}</p>
                <div className="mt-2">
                  {me.role === "owner" ? (
                    <Badge tone="amber" icon={<CrownIcon size={12} />}>
                      Owner
                    </Badge>
                  ) : (
                    <Badge tone="violet" icon={<ShieldIcon size={12} />}>
                      Admin · {describeAccess(me.permissions)}
                    </Badge>
                  )}
                </div>
              </div>
              <MenuSeparator />
              <MenuItem
                icon={<ShieldIcon size={15} />}
                onSelect={() => {
                  setMenuOpen(false);
                  setTab("settings");
                }}
              >
                {me.role === "owner" ? "Manage admins" : "Your access"}
              </MenuItem>
              <MenuItem
                icon={<ExternalIcon size={15} />}
                onSelect={() => {
                  setMenuOpen(false);
                  window.open("/", "_blank", "noopener");
                }}
              >
                Open the site
              </MenuItem>
              <MenuItem
                icon={<LogOutIcon size={15} />}
                onSelect={() => {
                  setMenuOpen(false);
                  void signOut({ callbackUrl: "/" });
                }}
              >
                Sign out
              </MenuItem>
            </Popover>
          </div>
        </header>

        <main className="relative mx-auto max-w-[1240px] px-4 pb-28 pt-8 sm:px-6 sm:pt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[27px] font-semibold tracking-[-0.025em] sm:text-[30px]">
                {TABS.find((item) => item.value === tab)?.label}
              </h1>
              <p className="mt-1 max-w-[640px] text-[14px] leading-[1.5] text-white/45">{TAB_SUBTITLES[tab]}</p>
            </div>
            {locked ? (
              <button type="button" onClick={() => setTab("settings")}>
                <Badge tone="amber" icon={<LockIcon size={12} />}>
                  Room creation is locked
                </Badge>
              </button>
            ) : null}
          </div>

          <nav
            aria-label="Dashboard sections"
            className="relative mt-6 flex gap-6 overflow-x-auto border-b border-white/[0.08] [scrollbar-width:none] sm:gap-7"
          >
            {TABS.map((item) => {
              const active = item.value === tab;
              const count = counts[item.value];
              return (
                <button
                  key={item.value}
                  ref={(node) => {
                    if (node) tabRefs.current.set(item.value, node);
                    else tabRefs.current.delete(item.value);
                  }}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setTab(item.value)}
                  className={cx(
                    "flex shrink-0 items-center gap-1.5 pb-3 text-[14.5px] font-medium outline-none transition-colors focus-visible:text-white",
                    active ? "text-white" : "text-white/45 hover:text-white/80",
                  )}
                >
                  {item.label}
                  {count !== undefined ? (
                    <span className="rounded-full bg-white/[0.07] px-1.5 py-px text-[11px] tabular-nums text-white/55">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {underline ? (
              <span
                aria-hidden
                className="absolute bottom-[-1px] h-[2px] rounded-full bg-white transition-[left,width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
                style={{ left: underline.left, width: underline.width }}
              />
            ) : null}
          </nav>

          <div key={tab} className="animate-admin-rise mt-6">
            {loadError ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <p className="text-[15px] font-medium">Couldn&apos;t load the dashboard</p>
                <p className="max-w-[380px] text-[13px] text-white/45">{loadError}</p>
                <Button onClick={() => void refresh()}>Try again</Button>
              </div>
            ) : tab === "overview" ? (
              <OverviewView />
            ) : tab === "rooms" ? (
              <RoomsView />
            ) : tab === "people" ? (
              <PeopleView />
            ) : tab === "activity" ? (
              <ActivityView />
            ) : (
              <SettingsView />
            )}
          </div>
        </main>

        <RoomEditor
          target={editorTarget}
          onClose={() => setEditorTarget(null)}
          onCreated={(roomId) => focusOn({ tab: "rooms", roomId })}
        />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <AccessDialog target={accessTarget} onClose={() => setAccessTarget(null)} />
      </div>
    </AdminContextProvider>
  );
}
