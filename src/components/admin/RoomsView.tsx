"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ROOM_CATEGORIES, type RoomCategory } from "@/lib/rooms";
import type { AdminRoom } from "@/lib/admin/types";
import { useAdmin } from "./AdminContext";
import { formatCount, formatDate, formatRoomEnd, formatSpan, plural, roomImageUrl, roomStatus, timeAgo, type RoomStatus } from "./format";
import {
  CaretRightIcon,
  CopyIcon,
  ExternalIcon,
  EyeOffIcon,
  FilterIcon,
  FlagEndIcon,
  PencilIcon,
  PlusIcon,
  RestoreIcon,
  RoomsIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from "./icons";
import { DatePicker } from "./pickers";
import RoomDetail from "./RoomDetail";
import {
  ActionMenu,
  Badge,
  Button,
  Card,
  EmptyState,
  MenuItem,
  MenuSeparator,
  Popover,
  Segmented,
  Skeleton,
  TextInput,
  cx,
} from "./ui";

type Scope = "all" | "live" | "ended" | "private" | "trash";
type SortKey = "newest" | "oldest" | "ending" | "people" | "messages" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  oldest: "Oldest",
  ending: "Ending soonest",
  people: "Most people",
  messages: "Most messages",
  name: "Name A–Z",
};

type Filters = { categories: RoomCategory[]; from: string | null; to: string | null; sort: SortKey };
const DEFAULT_FILTERS: Filters = { categories: [], from: null, to: null, sort: "newest" };

export function StatusBadge({ room, now }: { room: AdminRoom; now: number }) {
  const status = roomStatus(room, now);
  const left = Date.parse(room.endsAt) - now;
  const variants: Record<RoomStatus, { tone: "green" | "amber" | "neutral" | "red"; label: string }> = {
    active: { tone: "green", label: `Live · ${formatSpan(left)} left` },
    soon: { tone: "amber", label: `Ends in ${formatSpan(left)}` },
    ended: { tone: "neutral", label: "Ended" },
    trashed: { tone: "red", label: "In trash" },
  };
  const { tone, label } = variants[status];
  return (
    <Badge tone={tone} dot={status === "active" || status === "soon"}>
      {label}
    </Badge>
  );
}

export function RoomThumb({ room, size = 40 }: { room: AdminRoom; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      loading="lazy"
      src={roomImageUrl(room)}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-[10px] bg-white/[0.05] object-cover ring-1 ring-white/[0.08]"
    />
  );
}

export default function RoomsView() {
  const { snapshot, now, openEditor, focus, clearFocus } = useAdmin();
  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const rooms = useMemo(() => snapshot?.rooms ?? [], [snapshot]);

  // Arriving from search or another tab: open that room's row and bring it into view.
  useEffect(() => {
    if (focus?.tab !== "rooms") return;
    const room = rooms.find((item) => item.id === focus.roomId);
    if (!room) return;
    const status = roomStatus(room, Date.now());
    setScope(status === "trashed" ? "trash" : "all");
    setQuery("");
    setFilters(DEFAULT_FILTERS);
    setExpanded(room.id);
    clearFocus();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => rowRefs.current.get(room.id)?.scrollIntoView({ block: "center", behavior: "smooth" })),
    );
  }, [focus, rooms, clearFocus]);

  const counts = useMemo(() => {
    const result = { all: 0, live: 0, ended: 0, private: 0, trash: 0 };
    for (const room of rooms) {
      const status = roomStatus(room, now);
      if (status === "trashed") {
        result.trash += 1;
        continue;
      }
      result.all += 1;
      if (status === "ended") result.ended += 1;
      else result.live += 1;
      if (room.isPrivate) result.private += 1;
    }
    return result;
  }, [rooms, now]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rooms.filter((room) => {
      const status = roomStatus(room, now);
      if (scope === "trash" ? status !== "trashed" : status === "trashed") return false;
      if (scope === "live" && status !== "active" && status !== "soon") return false;
      if (scope === "ended" && status !== "ended") return false;
      if (scope === "private" && !room.isPrivate) return false;
      if (filters.categories.length > 0 && !filters.categories.includes(room.category)) return false;
      const created = room.createdAt.slice(0, 10);
      if (filters.from && created < filters.from) return false;
      if (filters.to && created > filters.to) return false;
      if (q) {
        const haystack = `${room.name} ${room.createdByLabel} ${room.createdBy} ${room.category} ${room.id}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    const sorters: Record<SortKey, (a: AdminRoom, b: AdminRoom) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
      ending: (a, b) => a.endsAt.localeCompare(b.endsAt),
      people: (a, b) => b.participantCount - a.participantCount,
      messages: (a, b) => b.messageCount - a.messageCount,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(sorters[filters.sort]);
  }, [rooms, scope, query, filters, now]);

  const activeFilterCount =
    filters.categories.length + (filters.from ? 1 : 0) + (filters.to ? 1 : 0) + (filters.sort !== "newest" ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          value={scope}
          onChange={(value) => {
            setScope(value);
            setExpanded(null);
          }}
          ariaLabel="Which rooms"
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "live", label: "Live", count: counts.live },
            { value: "ended", label: "Ended", count: counts.ended },
            { value: "private", label: "Private", count: counts.private },
            { value: "trash", label: "Trash", count: counts.trash },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <TextInput
            leading={<SearchIcon size={15} />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search rooms or hosts"
            className="min-w-0 flex-1 sm:w-[240px] sm:flex-none"
          />
          <span className="hidden h-5 w-px bg-white/[0.1] sm:block" />
          <Button
            ref={filterButtonRef}
            variant="secondary"
            icon={<FilterIcon size={15} />}
            onClick={() => setFiltersOpen((current) => !current)}
            className={cx(filtersOpen && "border-[#8fb2ff]/55 shadow-[0_0_0_4px_rgba(143,178,255,0.12)]")}
          >
            Filters
            {activeFilterCount > 0 ? (
              <span className="flex size-[18px] items-center justify-center rounded-full bg-white text-[10.5px] font-semibold text-black">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
          <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => openEditor("new")}>
            New room
          </Button>
        </div>
      </div>

      <FiltersPopover
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        anchorRef={filterButtonRef}
        filters={filters}
        onChange={setFilters}
      />

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[22px_minmax(0,2.6fr)_minmax(0,1.25fr)_minmax(0,0.85fr)_minmax(0,1.2fr)_64px_76px_minmax(0,0.85fr)_36px] items-center gap-3 border-b border-white/[0.06] px-5 py-3 text-[12px] font-medium text-white/40 lg:grid">
          <span />
          <span>Room</span>
          <span>Status</span>
          <span>Category</span>
          <span>Ends (UTC)</span>
          <span className="text-right">People</span>
          <span className="text-right">Messages</span>
          <span>Created</span>
          <span />
        </div>

        {!snapshot ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={scope === "trash" ? <TrashIcon size={18} /> : <RoomsIcon size={18} />}
            title={scope === "trash" ? "The trash is empty" : query || activeFilterCount ? "No rooms match" : "No rooms here yet"}
            body={
              scope === "trash"
                ? "Rooms you delete land here first, so you can bring them back."
                : query || activeFilterCount
                  ? "Try a different search or clear the filters."
                  : undefined
            }
            action={
              query || activeFilterCount ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setFilters(DEFAULT_FILTERS);
                  }}
                >
                  Clear search and filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div>
            {visible.map((room, i) => (
              <Fragment key={room.id}>
                <RoomRow
                  room={room}
                  now={now}
                  first={i === 0}
                  expanded={expanded === room.id}
                  onToggle={() => setExpanded((current) => (current === room.id ? null : room.id))}
                  rowRef={(node) => {
                    if (node) rowRefs.current.set(room.id, node);
                    else rowRefs.current.delete(room.id);
                  }}
                />
                {expanded === room.id ? (
                  <div className="border-t border-white/[0.05] bg-black/[0.15]">
                    <RoomDetail roomId={room.id} />
                  </div>
                ) : null}
              </Fragment>
            ))}
          </div>
        )}
      </Card>

      {scope === "trash" && counts.trash > 0 ? (
        <p className="px-1 text-[12.5px] text-white/40">
          Rooms in the trash are hidden from everyone. Restore puts a room back exactly as it was — people, chat and
          all.
        </p>
      ) : null}
    </div>
  );
}

function RoomRow({
  room,
  now,
  first,
  expanded,
  onToggle,
  rowRef,
}: {
  room: AdminRoom;
  now: number;
  first: boolean;
  expanded: boolean;
  onToggle: () => void;
  rowRef: (node: HTMLDivElement | null) => void;
}) {
  const status = roomStatus(room, now);

  return (
    <div
      ref={rowRef}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      className={cx(
        "group grid cursor-pointer grid-cols-[22px_minmax(0,1fr)_36px] items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] sm:px-5 lg:grid-cols-[22px_minmax(0,2.6fr)_minmax(0,1.25fr)_minmax(0,0.85fr)_minmax(0,1.2fr)_64px_76px_minmax(0,0.85fr)_36px]",
        !first && "border-t border-white/[0.05]",
        expanded && "bg-white/[0.03]",
      )}
    >
      <span className={cx("text-white/35 transition-transform duration-200", expanded && "rotate-90 text-white/70")}>
        <CaretRightIcon size={10} />
      </span>

      <div className="flex min-w-0 items-center gap-3">
        <RoomThumb room={room} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-medium">{room.name}</span>
            {room.isPrivate ? (
              <span title="Private room" className="shrink-0 text-[#c4b5fd]">
                <EyeOffIcon size={14} />
              </span>
            ) : null}
          </div>
          <p className="truncate text-[12.5px] text-white/40">
            by {room.createdByLabel}
            <span className="lg:hidden">
              {" · "}
              {plural(room.participantCount, "person", "people")} · {room.category}
            </span>
          </p>
          <div className="mt-1.5 lg:hidden">
            <StatusBadge room={room} now={now} />
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        <StatusBadge room={room} now={now} />
      </div>
      <span className="hidden truncate text-[13px] text-white/65 lg:block">{room.category}</span>
      <span className="hidden truncate text-[13px] tabular-nums text-white/65 lg:block" title={formatRoomEnd(room)}>
        {formatRoomEnd(room)}
      </span>
      <span className="hidden text-right text-[13px] tabular-nums text-white/80 lg:block">
        {formatCount(room.participantCount)}
      </span>
      <span className="hidden text-right text-[13px] tabular-nums text-white/80 lg:block">
        {formatCount(room.messageCount)}
      </span>
      <span className="hidden text-[13px] text-white/50 lg:block" title={formatDate(room.createdAt)}>
        {timeAgo(room.createdAt, now)}
      </span>

      <div onClick={(event) => event.stopPropagation()} className="flex justify-end">
        <RoomActions room={room} status={status} />
      </div>
    </div>
  );
}

export function RoomActions({ room, status }: { room: AdminRoom; status: RoomStatus }) {
  const { openEditor, change, confirm, notify } = useAdmin();
  const link = typeof window !== "undefined" ? `${window.location.origin}/rooms/${room.id}` : `/rooms/${room.id}`;

  return (
    <ActionMenu label={`Actions for ${room.name}`}>
      {(close) =>
        status === "trashed" ? (
          <>
            <MenuItem
              icon={<RestoreIcon size={15} />}
              onSelect={() => {
                close();
                void change("room.restore", { id: room.id });
              }}
            >
              Restore
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              tone="danger"
              icon={<XIcon size={15} />}
              onSelect={async () => {
                close();
                const ok = await confirm({
                  title: `Delete “${room.name}” permanently?`,
                  body: "Its chat, participants and everything else go for good. This is the one thing that can't be undone.",
                  confirmLabel: "Delete permanently",
                  tone: "danger",
                });
                if (ok) await change("room.purge", { id: room.id });
              }}
            >
              Delete permanently
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem
              icon={<PencilIcon size={15} />}
              onSelect={() => {
                close();
                openEditor(room);
              }}
            >
              Edit room
            </MenuItem>
            {status === "active" || status === "soon" ? (
              <MenuItem
                icon={<FlagEndIcon size={15} />}
                onSelect={async () => {
                  close();
                  const ok = await confirm({
                    title: `End “${room.name}” now?`,
                    body: "The countdown stops and the room switches to its summary for everyone. You can undo this.",
                    confirmLabel: "End now",
                  });
                  if (ok) await change("room.end", { id: room.id });
                }}
              >
                End now
              </MenuItem>
            ) : null}
            <MenuItem
              icon={<CopyIcon size={15} />}
              onSelect={async () => {
                close();
                try {
                  await navigator.clipboard.writeText(link);
                  notify("Room link copied", "success");
                } catch {
                  notify("Couldn't copy — your browser blocked it.", "error");
                }
              }}
            >
              Copy link
            </MenuItem>
            <MenuItem
              icon={<ExternalIcon size={15} />}
              onSelect={() => {
                close();
                window.open(`/rooms/${room.id}`, "_blank", "noopener");
              }}
            >
              Open room
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              tone="danger"
              icon={<TrashIcon size={15} />}
              onSelect={() => {
                close();
                void change("room.trash", { id: room.id });
              }}
            >
              Move to trash
            </MenuItem>
          </>
        )
      }
    </ActionMenu>
  );
}

function FiltersPopover({
  open,
  onClose,
  anchorRef,
  filters,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLButtonElement>;
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const toggleCategory = (category: RoomCategory) =>
    onChange({
      ...filters,
      categories: filters.categories.includes(category)
        ? filters.categories.filter((item) => item !== category)
        : [...filters.categories, category],
    });

  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} align="end" className="w-[min(380px,calc(100vw-16px))] p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-medium text-white/70">Category</span>
          <div className="flex flex-wrap gap-1.5">
            {ROOM_CATEGORIES.map((category) => {
              const on = filters.categories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={cx(
                    "h-7 rounded-[9px] px-2.5 text-[12px] font-medium transition-colors",
                    on
                      ? "bg-white text-black"
                      : "bg-white/[0.05] text-white/60 ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.09] hover:text-white",
                  )}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-medium text-white/70">Created between</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] text-white/40">From</span>
              <DatePicker value={filters.from} placeholder="Any day" onChange={(from) => onChange({ ...filters, from })} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] text-white/40">To</span>
              <DatePicker value={filters.to} placeholder="Any day" onChange={(to) => onChange({ ...filters, to })} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-medium text-white/70">Sort by</span>
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ ...filters, sort: key })}
                className={cx(
                  "flex h-8 items-center rounded-[9px] px-2.5 text-left text-[12.5px] transition-colors",
                  filters.sort === key ? "bg-white/[0.1] text-white" : "text-white/55 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                {SORT_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.07] pt-3">
          <Button size="sm" variant="ghost" onClick={() => onChange(DEFAULT_FILTERS)}>
            Reset
          </Button>
          <Button size="sm" variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Popover>
  );
}
