"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AdminPerson, AdminRoom } from "@/lib/admin/types";
import { useAdmin, type AdminTab } from "./AdminContext";
import { formatCount, formatRoomEnd, plural, roomImageUrl, timeAgo } from "./format";
import {
  ActivityIcon,
  EnterIcon,
  GaugeIcon,
  LockIcon,
  PlusIcon,
  RefreshIcon,
  RoomsIcon,
  SearchIcon,
  SlidersIcon,
  UnlockIcon,
  UsersIcon,
} from "./icons";
import { StatusBadge } from "./RoomsView";
import { Avatar, Badge, Dialog, Kbd, cx } from "./ui";

type Item = {
  id: string;
  section: "Actions" | "Rooms" | "People";
  title: string;
  subtitle?: string;
  leading: ReactNode;
  preview: ReactNode;
  run: () => void;
};

function score(text: string, query: string): number {
  const haystack = text.toLowerCase();
  if (!query) return 1;
  if (haystack.startsWith(query)) return 3;
  if (haystack.split(/\s+/).some((word) => word.startsWith(query))) return 2;
  return haystack.includes(query) ? 1 : 0;
}

function RoomPreview({ room, now }: { room: AdminRoom; now: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={roomImageUrl(room)} className="aspect-[16/9] w-full max-w-[250px] rounded-[14px] object-cover ring-1 ring-white/10" />
      <div className="min-w-0 max-w-full">
        <p className="truncate text-[16px] font-semibold">{room.name}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-white/45">
          {room.category} · by {room.createdByLabel}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <StatusBadge room={room} now={now} />
        {room.isPrivate ? <Badge tone="violet">Private</Badge> : null}
      </div>
      <div className="grid w-full max-w-[250px] grid-cols-2 gap-2 text-left">
        <div className="rounded-[12px] bg-white/[0.04] px-3 py-2">
          <p className="text-[11px] text-white/40">People</p>
          <p className="text-[15px] font-semibold tabular-nums">{formatCount(room.participantCount)}</p>
        </div>
        <div className="rounded-[12px] bg-white/[0.04] px-3 py-2">
          <p className="text-[11px] text-white/40">Messages</p>
          <p className="text-[15px] font-semibold tabular-nums">{formatCount(room.messageCount)}</p>
        </div>
      </div>
      <p className="text-[12px] text-white/35">Ends {formatRoomEnd(room)} UTC</p>
    </div>
  );
}

function PersonPreview({ person, now }: { person: AdminPerson; now: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Avatar name={person.name} image={person.image} size={72} />
      <div className="min-w-0 max-w-full">
        <p className="truncate text-[16px] font-semibold">{person.name}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-white/45">{person.email ?? `Anonymous #${person.anonNumber}`}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <Badge tone={person.kind === "google" ? "blue" : "neutral"}>
          {person.kind === "google" ? "Google account" : "Anonymous"}
        </Badge>
        {person.suspended ? <Badge tone="red">Suspended</Badge> : null}
      </div>
      <p className="text-[12.5px] text-white/45">
        {plural(person.roomsJoined, "room")} joined · {plural(person.roomsCreated, "room")} created
      </p>
      <p className="text-[12px] text-white/35">Last active {timeAgo(person.lastSeenAt ?? person.firstSeenAt, now)}</p>
    </div>
  );
}

function ActionPreview({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-[18px] border border-white/[0.08] bg-white/[0.04] text-white/70">
        {icon}
      </span>
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="max-w-[260px] text-[12.5px] leading-[1.5] text-white/45">{body}</p>
    </div>
  );
}

/** ⌘K: jump to any room or person, or run an action, from anywhere. */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snapshot, people, refreshPeople, setTab, focusOn, openEditor, change, now } = useAdmin();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    if (!people) void refreshPeople();
  }, [open, people, refreshPeople]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    const locked = snapshot?.site.roomCreation.locked ?? false;
    const go = (tab: AdminTab) => () => {
      setTab(tab);
      onClose();
    };

    const actions: Item[] = [
      {
        id: "action:new-room",
        section: "Actions",
        title: "New room",
        subtitle: "Create a room",
        leading: <PlusIcon size={16} />,
        preview: <ActionPreview icon={<PlusIcon size={22} />} title="New room" body="Opens the room editor. It goes live the moment you create it." />,
        run: () => {
          onClose();
          openEditor("new");
        },
      },
      {
        id: "action:lock",
        section: "Actions",
        title: locked ? "Unlock room creation" : "Lock room creation",
        subtitle: locked ? "Let people create rooms again" : "Stop people creating rooms",
        leading: locked ? <UnlockIcon size={16} /> : <LockIcon size={16} />,
        preview: (
          <ActionPreview
            icon={locked ? <UnlockIcon size={22} /> : <LockIcon size={22} />}
            title={locked ? "Unlock room creation" : "Lock room creation"}
            body={
              locked
                ? "Create Room buttons work again for everyone, within seconds."
                : "Create Room buttons show a lock for everyone within seconds. You can still create rooms here."
            }
          />
        ),
        run: () => {
          onClose();
          void change("settings.roomCreation", { locked: !locked });
        },
      },
      {
        id: "action:refresh",
        section: "Actions",
        title: "Refresh everyone's pages",
        subtitle: "Push the latest data to every open page",
        leading: <RefreshIcon size={16} />,
        preview: <ActionPreview icon={<RefreshIcon size={22} />} title="Refresh everyone's pages" body="Every open page re-fetches its data within a few seconds." />,
        run: () => {
          onClose();
          void change("site.refresh", {});
        },
      },
      ...(
        [
          ["overview", "Go to Overview", <GaugeIcon key="i" size={16} />],
          ["rooms", "Go to Rooms", <RoomsIcon key="i" size={16} />],
          ["people", "Go to People", <UsersIcon key="i" size={16} />],
          ["activity", "Go to Activity", <ActivityIcon key="i" size={16} />],
          ["settings", "Go to Settings", <SlidersIcon key="i" size={16} />],
        ] as [AdminTab, string, ReactNode][]
      ).map(([tab, title, icon]) => ({
        id: `action:tab:${tab}`,
        section: "Actions" as const,
        title,
        leading: icon,
        preview: <ActionPreview icon={icon} title={title} body="Jump straight there." />,
        run: go(tab),
      })),
    ];

    const matchingActions = actions
      .map((item) => ({ item, s: score(`${item.title} ${item.subtitle ?? ""}`, q) }))
      .filter(({ s }) => s > 0)
      .sort((a, b) => b.s - a.s)
      .map(({ item }) => item)
      .slice(0, q ? 4 : 3);

    const rooms: Item[] = (snapshot?.rooms ?? [])
      .map((room) => ({ room, s: score(`${room.name} ${room.createdByLabel} ${room.category}`, q) }))
      .filter(({ s }) => s > 0)
      .sort((a, b) => b.s - a.s || (a.room.trashedAt ? 1 : 0) - (b.room.trashedAt ? 1 : 0) || b.room.createdAt.localeCompare(a.room.createdAt))
      .slice(0, q ? 6 : 4)
      .map(({ room }) => ({
        id: `room:${room.id}`,
        section: "Rooms" as const,
        title: room.name,
        subtitle: room.trashedAt ? "In trash" : `${plural(room.participantCount, "person", "people")} · ${room.category}`,
        leading: (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={roomImageUrl(room)} className="size-6 rounded-[7px] object-cover ring-1 ring-white/10" />
        ),
        preview: <RoomPreview room={room} now={now} />,
        run: () => {
          onClose();
          focusOn({ tab: "rooms", roomId: room.id });
        },
      }));

    const peopleItems: Item[] = (people ?? [])
      .filter((person) => q || person.kind === "google")
      .map((person) => ({
        person,
        s: score(`${person.name} ${person.email ?? ""} ${person.anonNumber ?? ""}`, q),
      }))
      .filter(({ s }) => s > 0)
      .sort(
        (a, b) =>
          b.s - a.s ||
          (a.person.kind === "google" ? 0 : 1) - (b.person.kind === "google" ? 0 : 1) ||
          (b.person.lastSeenAt ?? "").localeCompare(a.person.lastSeenAt ?? ""),
      )
      .slice(0, q ? 6 : 4)
      .map(({ person }) => ({
        id: `person:${person.identity}`,
        section: "People" as const,
        title: person.name,
        subtitle: person.email ?? `Anonymous #${person.anonNumber}`,
        leading: <Avatar name={person.name} image={person.image} size={24} />,
        preview: <PersonPreview person={person} now={now} />,
        run: () => {
          onClose();
          focusOn({ tab: "people", identity: person.identity });
        },
      }));

    return [...matchingActions, ...rooms, ...peopleItems];
  }, [query, snapshot, people, now, setTab, onClose, openEditor, change, focusOn]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const current = items[Math.min(active, items.length - 1)];

  return (
    <Dialog open={open} onClose={onClose} width={780} placement="top" className="overflow-hidden" labelledBy="palette-input">
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
        <span className="text-white/40">
          <SearchIcon size={17} />
        </span>
        <input
          id="palette-input"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, items.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              current?.run();
            }
          }}
          placeholder="Search rooms, people, or type a command…"
          className="h-[54px] min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/30"
        />
        <Kbd>esc</Kbd>
      </div>

      <div className="grid h-[min(420px,60vh)] grid-cols-1 sm:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
        <div ref={listRef} className="admin-scroll min-h-0 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-white/40">
              {people === null ? "Loading people…" : "Nothing matches that."}
            </p>
          ) : (
            items.map((item, index) => (
              <div key={item.id}>
                {index === 0 || items[index - 1].section !== item.section ? (
                  <p className="px-2.5 pb-1 pt-2.5 text-[11.5px] font-medium text-white/35">{item.section}</p>
                ) : null}
                <button
                  type="button"
                  data-index={index}
                  onMouseMove={() => setActive(index)}
                  onClick={() => item.run()}
                  className={cx(
                    "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors",
                    index === active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
                  )}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center text-white/55">{item.leading}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-white/90">{item.title}</span>
                  </span>
                  {item.subtitle ? (
                    <span className="hidden max-w-[45%] shrink-0 truncate text-[11.5px] text-white/35 sm:block">
                      {item.subtitle}
                    </span>
                  ) : null}
                </button>
              </div>
            ))
          )}
        </div>
        <div className="hidden min-h-0 flex-col border-l border-white/[0.07] bg-black/[0.12] p-3 sm:flex">
          {current ? (
            <div className="min-h-0 flex-1 overflow-hidden rounded-[16px] border border-white/[0.06] bg-white/[0.025]">
              {current.preview}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-4 py-2.5 text-[12px] text-white/40">
        <span className="hidden sm:inline">The Waiting Room · Admin</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            Open <Kbd><EnterIcon size={12} /></Kbd>
          </span>
          <span className="flex items-center gap-1.5">
            Move <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
          </span>
        </span>
      </div>
    </Dialog>
  );
}
