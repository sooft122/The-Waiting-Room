"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PERMISSION_FOR_KIND } from "@/lib/admin/permissions";
import type { AdminActionKind, AdminLogEntry } from "@/lib/admin/types";
import { useAdmin } from "./AdminContext";
import { formatDateTime, timeAgo } from "./format";
import {
  ActivityIcon,
  BanIcon,
  CheckIcon,
  EyeOffIcon,
  FlagEndIcon,
  LockIcon,
  MessageIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  RestoreIcon,
  RoomsIcon,
  SearchIcon,
  ShieldIcon,
  TrashIcon,
  UserIcon,
  UserPlusIcon,
  XIcon,
} from "./icons";
import { Badge, Button, Card, EmptyState, Segmented, Skeleton, TextInput, cx } from "./ui";

type Filter = "all" | "rooms" | "people" | "admins" | "settings";

const KIND_STYLE: Record<AdminActionKind, { icon: ReactNode; tint: string }> = {
  "room.create": { icon: <PlusIcon size={15} />, tint: "#6ee7b7" },
  "room.update": { icon: <PencilIcon size={15} />, tint: "#93c5fd" },
  "room.end": { icon: <FlagEndIcon size={15} />, tint: "#fcd34d" },
  "room.trash": { icon: <TrashIcon size={15} />, tint: "#ff9a9d" },
  "room.restore": { icon: <RestoreIcon size={15} />, tint: "#6ee7b7" },
  "room.purge": { icon: <XIcon size={15} />, tint: "#ff9a9d" },
  "room.removePerson": { icon: <UserIcon size={15} />, tint: "#fcd34d" },
  "chat.post": { icon: <MessageIcon size={15} />, tint: "#93c5fd" },
  "chat.delete": { icon: <MessageIcon size={15} />, tint: "#ff9a9d" },
  "chat.clear": { icon: <MessageIcon size={15} />, tint: "#ff9a9d" },
  "person.update": { icon: <PencilIcon size={15} />, tint: "#c4b5fd" },
  "person.suspend": { icon: <BanIcon size={15} />, tint: "#ff9a9d" },
  "person.unsuspend": { icon: <CheckIcon size={15} />, tint: "#6ee7b7" },
  "person.leaveAll": { icon: <RoomsIcon size={15} />, tint: "#fcd34d" },
  "settings.roomCreation": { icon: <LockIcon size={15} />, tint: "#c4b5fd" },
  "site.refresh": { icon: <RefreshIcon size={15} />, tint: "#93c5fd" },
  "admin.add": { icon: <UserPlusIcon size={15} />, tint: "#c4b5fd" },
  "admin.update": { icon: <ShieldIcon size={15} />, tint: "#c4b5fd" },
  "admin.remove": { icon: <ShieldIcon size={15} />, tint: "#ff9a9d" },
};

function matchesFilter(entry: AdminLogEntry, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "admins") return entry.targetType === "admin";
  if (filter === "settings") return entry.targetType === "settings" || entry.targetType === "site";
  if (filter === "people") return entry.kind.startsWith("person.") || entry.kind === "room.removePerson";
  return entry.kind.startsWith("room.") || entry.kind.startsWith("chat.");
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return "Today";
  if (same(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function LogRow({ entry, compact }: { entry: AdminLogEntry; compact?: boolean }) {
  const { reverse, now, snapshot, admin, focusOn, setTab, deny } = useAdmin();
  const [busy, setBusy] = useState(false);
  const style = KIND_STYLE[entry.kind] ?? { icon: <ActivityIcon size={15} />, tint: "#ffffff" };
  const undone = entry.status === "undone";
  const room = entry.targetType === "room" ? snapshot?.rooms.find((item) => item.id === entry.targetId) : undefined;
  const canOpen = entry.targetType === "person" || entry.targetType === "admin" || !!room;
  // Undoing or redoing takes the same permission as making the change.
  const reverseLock = deny(PERMISSION_FOR_KIND[entry.kind] ?? "owner");

  return (
    <div className="group flex items-start gap-3 rounded-[14px] px-3 py-2.5 transition-colors hover:bg-white/[0.03]">
      <span
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: `${style.tint}14`, color: style.tint, boxShadow: `inset 0 0 0 1px ${style.tint}26` }}
      >
        {style.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx("text-[13.5px] leading-[1.45]", undone ? "text-white/40 line-through decoration-white/25" : "text-white/85")}>
          {canOpen ? (
            <button
              type="button"
              className="text-left hover:underline"
              onClick={() =>
                entry.targetType === "admin"
                  ? setTab("settings")
                  : entry.targetType === "person"
                    ? focusOn({ tab: "people", identity: entry.targetId })
                    : focusOn({ tab: "rooms", roomId: entry.targetId })
              }
            >
              {entry.summary}
            </button>
          ) : (
            entry.summary
          )}
        </p>
        <p className="mt-0.5 text-[12px] text-white/35" title={formatDateTime(entry.at)}>
          {timeAgo(entry.at, now)}
          {entry.actor !== admin.email ? ` · by ${entry.actor}` : ""}
          {undone && entry.changedAt ? ` · undone ${timeAgo(entry.changedAt, now)}` : ""}
        </p>
      </div>
      {undone ? <Badge className={compact ? "hidden sm:inline-flex" : undefined}>Undone</Badge> : null}
      {entry.undoable ? (
        <Button
          size="sm"
          variant={compact ? "ghost" : "secondary"}
          locked={reverseLock}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await reverse(entry);
            setBusy(false);
          }}
        >
          {undone ? "Redo" : "Undo"}
        </Button>
      ) : (
        <span className="shrink-0 pt-1.5 text-[11.5px] text-white/30">{entry.kind === "room.purge" ? "Permanent" : ""}</span>
      )}
    </div>
  );
}

export default function ActivityView() {
  const { snapshot } = useAdmin();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const entries = (snapshot?.log ?? []).filter(
      (entry) =>
        matchesFilter(entry, filter) &&
        (!q || `${entry.summary} ${entry.targetLabel} ${entry.targetId}`.toLowerCase().includes(q)),
    );
    const byDay: { label: string; entries: AdminLogEntry[] }[] = [];
    for (const entry of entries) {
      const label = dayLabel(entry.at);
      const last = byDay[byDay.length - 1];
      if (last?.label === label) last.entries.push(entry);
      else byDay.push({ label, entries: [entry] });
    }
    return byDay;
  }, [snapshot, filter, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={filter}
          onChange={setFilter}
          ariaLabel="Which changes"
          options={[
            { value: "all", label: "All" },
            { value: "rooms", label: "Rooms & chat" },
            { value: "people", label: "People" },
            { value: "admins", label: "Admins" },
            { value: "settings", label: "Settings" },
          ]}
        />
        <TextInput
          leading={<SearchIcon size={15} />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search changes"
          className="sm:w-[240px]"
        />
      </div>

      <Card className="p-2 sm:p-3">
        {!snapshot ? (
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<ActivityIcon size={18} />}
            title={query || filter !== "all" ? "No changes match" : "No changes yet"}
            body="Everything you do from this dashboard is listed here, and almost all of it can be undone."
          />
        ) : (
          groups.map((group) => (
            <div key={group.label} className="py-1">
              <p className="px-3 pb-1 pt-2 text-[12px] font-medium uppercase tracking-[0.06em] text-white/35">{group.label}</p>
              {group.entries.map((entry) => (
                <LogRow key={entry.id} entry={entry} />
              ))}
            </div>
          ))
        )}
      </Card>

      <p className="flex items-center gap-2 px-1 text-[12.5px] text-white/35">
        <EyeOffIcon size={14} />
        Only admins can see this log. Changes stay undoable for 90 days; deleting a room permanently is the one
        exception.
      </p>
    </div>
  );
}
