"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ALL_PERMISSIONS, describeAccess, permissionPhrase, type AdminRole } from "@/lib/admin/permissions";
import type { AdminPerson, AdminPersonDetail, AdminSnapshot } from "@/lib/admin/types";
import { getCountryName } from "@/lib/countries";
import { useAdmin } from "./AdminContext";
import Flag from "./Flag";
import { MOOD_EMOJI, formatCount, formatDate, formatDateTime, formatSpan, plural, timeAgo } from "./format";
import {
  BanIcon,
  CheckIcon,
  CrownIcon,
  MessageIcon,
  PencilIcon,
  RoomsIcon,
  SearchIcon,
  ShieldIcon,
  TrashIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "./icons";
import { RoomThumb, StatusBadge } from "./RoomsView";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  IconButton,
  Segmented,
  Skeleton,
  Switch,
  TextInput,
  cx,
} from "./ui";
import { useLatest } from "./useLatest";

type Segment = "accounts" | "anonymous" | "everyone" | "suspended";
type SortKey = "active" | "newest" | "rooms" | "name";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "active", label: "Last active" },
  { value: "newest", label: "Newest" },
  { value: "rooms", label: "Most rooms" },
  { value: "name", label: "Name" },
];

const PAGE_SIZE = 60;

/** An Anonymous visitor who's never done anything — most of them are
 * one-off visits and crawlers, so they're tucked away by default. */
function isIdle(person: AdminPerson): boolean {
  return (
    person.kind === "anonymous" &&
    person.roomsJoined === 0 &&
    person.roomsCreated === 0 &&
    !person.suspended &&
    !person.nameOverride
  );
}

function lastActive(person: AdminPerson): string {
  return person.lastSeenAt ?? person.firstSeenAt ?? "";
}

/** Whether this account can open the dashboard, and as what. */
export function adminRoleOf(snapshot: AdminSnapshot | null, email: string | null): AdminRole | null {
  if (!snapshot || !email) return null;
  const key = email.toLowerCase();
  if (snapshot.team.owners.includes(key)) return "owner";
  return snapshot.team.members.some((member) => member.email === key) ? "admin" : null;
}

function RoleBadge({ role }: { role: AdminRole | null }) {
  if (role === "owner") {
    return (
      <Badge tone="amber" icon={<CrownIcon size={12} />}>
        Owner
      </Badge>
    );
  }
  if (role === "admin") {
    return (
      <Badge tone="violet" icon={<ShieldIcon size={12} />}>
        Admin
      </Badge>
    );
  }
  return null;
}

export default function PeopleView() {
  const { people, refreshPeople, focus, clearFocus, now, snapshot } = useAdmin();
  const [segment, setSegment] = useState<Segment>("accounts");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("active");
  const [showIdle, setShowIdle] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    void refreshPeople();
  }, [refreshPeople]);

  // Arriving from search or a room: select that person.
  useEffect(() => {
    if (focus?.tab !== "people") return;
    const identity = focus.identity;
    setSelected(identity);
    setQuery("");
    setSegment(identity.startsWith("anon:") ? "anonymous" : "accounts");
    if (identity.startsWith("anon:")) setShowIdle(true);
    clearFocus();
  }, [focus, clearFocus]);

  const counts = useMemo(() => {
    const list = people ?? [];
    return {
      accounts: list.filter((person) => person.kind === "google").length,
      anonymous: list.filter((person) => person.kind === "anonymous").length,
      everyone: list.length,
      suspended: list.filter((person) => person.suspended).length,
      idle: list.filter(isIdle).length,
    };
  }, [people]);

  const normalizedQuery = query.trim().toLowerCase().replace(/^#/, "");
  const matchesQuery = useCallback(
    (person: AdminPerson) =>
      `${person.name} ${person.email ?? ""} ${person.anonNumber ?? ""} ${person.identity}`
        .toLowerCase()
        .includes(normalizedQuery),
    [normalizedQuery],
  );

  const visible = useMemo(() => {
    const list = (people ?? []).filter((person) => {
      if (segment === "accounts" && person.kind !== "google") return false;
      if (segment === "anonymous" && person.kind !== "anonymous") return false;
      if (segment === "suspended" && !person.suspended) return false;
      if (normalizedQuery) return matchesQuery(person);
      // Idle visitors only show up when asked for (or searched for directly).
      return showIdle || segment === "suspended" || !isIdle(person);
    });
    const sorters: Record<SortKey, (a: AdminPerson, b: AdminPerson) => number> = {
      active: (a, b) => lastActive(b).localeCompare(lastActive(a)),
      newest: (a, b) => (b.firstSeenAt ?? "").localeCompare(a.firstSeenAt ?? ""),
      rooms: (a, b) => b.roomsJoined + b.roomsCreated - (a.roomsJoined + a.roomsCreated),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(sorters[sort]);
  }, [people, segment, normalizedQuery, matchesQuery, sort, showIdle]);

  // A search that finds nobody here may still find someone in another group.
  const matchesElsewhere = useMemo(
    () => (normalizedQuery && visible.length === 0 ? (people ?? []).filter(matchesQuery).length : 0),
    [normalizedQuery, visible.length, people, matchesQuery],
  );

  function onQueryChange(value: string) {
    setQuery(value);
    // "#42" means an Anonymous number; an "@" means an email address.
    const trimmed = value.trim();
    if (/^#\d/.test(trimmed) && segment === "accounts") setSegment("anonymous");
    else if (trimmed.includes("@") && segment === "anonymous") setSegment("accounts");
  }

  useEffect(() => setLimit(PAGE_SIZE), [segment, query, sort, showIdle]);

  const hiddenIdle = !query && !showIdle && segment !== "accounts" && segment !== "suspended" ? counts.idle : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          value={segment}
          onChange={setSegment}
          ariaLabel="Which people"
          options={[
            { value: "accounts", label: "Accounts", count: counts.accounts },
            { value: "anonymous", label: "Anonymous", count: counts.anonymous },
            { value: "everyone", label: "Everyone", count: counts.everyone },
            { value: "suspended", label: "Suspended", count: counts.suspended },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <TextInput
            leading={<SearchIcon size={15} />}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Name, email or #number"
            className="min-w-0 flex-1 sm:w-[240px] sm:flex-none"
          />
          <Segmented size="sm" value={sort} onChange={setSort} options={SORTS} ariaLabel="Sort people" />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Card className="overflow-hidden">
          {!people ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={18} />}
              title={query ? "Nobody matches that here" : segment === "suspended" ? "Nobody's suspended" : "Nobody here yet"}
              body={
                query && !matchesElsewhere ? "Try a name, an email address, or an Anonymous number like #42." : undefined
              }
              action={
                matchesElsewhere ? (
                  <Button size="sm" onClick={() => setSegment("everyone")}>
                    Show {plural(matchesElsewhere, "match", "matches")} in Everyone
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="p-1.5">
              {visible.slice(0, limit).map((person) => (
                <PersonRow
                  key={person.identity}
                  person={person}
                  role={adminRoleOf(snapshot, person.email)}
                  now={now}
                  selected={selected === person.identity}
                  onSelect={() => setSelected(person.identity)}
                />
              ))}
              {visible.length > limit ? (
                <div className="p-2">
                  <Button variant="ghost" className="w-full" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
                    Show more ({formatCount(visible.length - limit)} left)
                  </Button>
                </div>
              ) : null}
            </div>
          )}
          {hiddenIdle > 0 || (showIdle && segment !== "accounts" && segment !== "suspended") ? (
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3">
              <p className="text-[12.5px] leading-[1.45] text-white/45">
                {showIdle
                  ? "Showing visitors who never joined or created a room."
                  : `${plural(hiddenIdle, "visitor")} who never joined a room ${hiddenIdle === 1 ? "is" : "are"} hidden.`}
              </p>
              <Switch checked={showIdle} onChange={setShowIdle} label="Show idle visitors" />
            </div>
          ) : null}
        </Card>

        <div className="hidden lg:sticky lg:top-[76px] lg:block">
          {selected ? (
            <PersonPanel key={selected} identity={selected} onClose={() => setSelected(null)} />
          ) : (
            <Card>
              <EmptyState
                icon={<UserIcon size={18} />}
                title="Pick someone"
                body="Their profile, rooms and messages show up here — and everything you can do about them."
              />
            </Card>
          )}
        </div>
      </div>

      {/* Phones and tablets: the profile opens over the list. */}
      <MobilePersonSheet identity={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function PersonRow({
  person,
  role,
  now,
  selected,
  onSelect,
}: {
  person: AdminPerson;
  role: AdminRole | null;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const rooms = person.roomsJoined;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        "flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left outline-none transition-colors focus-visible:bg-white/[0.06]",
        selected ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
      )}
    >
      <Avatar name={person.name} image={person.image} size={34} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-medium">{person.name}</span>
          <RoleBadge role={role} />
          {person.suspended ? <Badge tone="red">Suspended</Badge> : null}
        </span>
        <span className="block truncate text-[12px] text-white/40">
          {person.email ?? (person.nameOverride ? `Anonymous #${person.anonNumber}` : "Anonymous visitor")}
        </span>
      </span>
      <span className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
        <span className="text-[12.5px] tabular-nums text-white/65">{plural(rooms, "room")}</span>
        <span className="text-[11.5px] text-white/35">{timeAgo(person.lastSeenAt ?? person.firstSeenAt, now)}</span>
      </span>
    </button>
  );
}

function MobilePersonSheet({ identity, onClose }: { identity: string | null; onClose: () => void }) {
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsSmall(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return (
    <Dialog open={isSmall && !!identity} onClose={onClose} width={520} placement="top" className="overflow-hidden">
      {identity ? <PersonPanel key={identity} identity={identity} onClose={onClose} bare /> : null}
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.025] px-3.5 py-3">
      <p className="text-[11.5px] text-white/40">{label}</p>
      <p className="mt-0.5 text-[17px] font-semibold tabular-nums tracking-[-0.01em]">{value}</p>
    </div>
  );
}

/** Everything about one person, and everything that can be done about them. */
export function PersonPanel({ identity, onClose, bare }: { identity: string; onClose: () => void; bare?: boolean }) {
  const { call, change, confirm, changeCount, focusOn, now, snapshot, me, deny } = useAdmin();
  const [detail, setDetail] = useState<AdminPersonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const fetchDetail = useCallback(() => call<AdminPersonDetail>("person.get", { identity }), [call, identity]);
  const applyDetail = useCallback((next: AdminPersonDetail) => {
    setDetail(next);
    setError(null);
  }, []);
  const detailFailed = useCallback(
    (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't load this person."),
    [],
  );
  const load = useLatest(fetchDetail, applyDetail, detailFailed);

  useEffect(() => {
    void load();
  }, [load, changeCount]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const body = (() => {
    if (error && !detail) return <p className="p-6 text-[13px] text-[#ff9a9d]">{error}</p>;
    if (!detail) {
      return (
        <div className="flex flex-col items-center gap-3 p-6">
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
          <div className="mt-2 grid w-full grid-cols-2 gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>
      );
    }

    const { person, rooms, messages, totalWaitMs } = detail;
    const role = adminRoleOf(snapshot, person.email);
    const leavableRooms = rooms.filter((room) => !room.isHost && !room.room.trashedAt);
    // Another admin's account is the owner's to change (the API agrees).
    const accountLock =
      role && me.role !== "owner" && person.email?.toLowerCase() !== me.email.toLowerCase()
        ? "Only the owner can change another admin's account."
        : null;
    const editLock = deny("people.edit") ?? accountLock;
    const membershipLock = deny("rooms.people") ?? accountLock;
    const canDeleteMessages = !deny("chat.moderate");

    async function run(key: string, action: () => Promise<unknown>) {
      setBusy(key);
      await action();
      setBusy(null);
    }

    return (
      <div className="flex flex-col">
        <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
          <Avatar name={person.name} image={person.image} size={68} />
          {renaming ? (
            <form
              className="mt-4 flex w-full max-w-[300px] items-center gap-1.5"
              onSubmit={async (event) => {
                event.preventDefault();
                await run("rename", () => change("person.update", { identity, displayName: draftName.trim() || null }));
                setRenaming(false);
              }}
            >
              <TextInput
                autoFocus
                value={draftName}
                maxLength={40}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder={person.kind === "anonymous" ? `Anonymous #${person.anonNumber}` : "Their Google name"}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setRenaming(false);
                  }
                }}
              />
              <IconButton label="Save name" type="submit" disabled={busy === "rename"}>
                <CheckIcon size={16} />
              </IconButton>
              <IconButton label="Cancel" onClick={() => setRenaming(false)}>
                <XIcon size={16} />
              </IconButton>
            </form>
          ) : (
            <h3 className="mt-4 max-w-full truncate text-[19px] font-semibold tracking-[-0.015em]">{person.name}</h3>
          )}
          <p className="mt-0.5 max-w-full truncate text-[13px] text-white/45">
            {person.email ?? `Anonymous #${person.anonNumber}`}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <Badge tone={person.kind === "google" ? "blue" : "neutral"}>
              {person.kind === "google" ? "Google account" : "Anonymous visitor"}
            </Badge>
            <RoleBadge role={role} />
            {person.suspended ? <Badge tone="red">Suspended</Badge> : null}
            {person.nameOverride ? <Badge>Custom name</Badge> : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 px-5">
          <Stat label="Rooms joined" value={formatCount(rooms.length)} />
          <Stat label="Rooms created" value={formatCount(person.roomsCreated)} />
          <Stat label="Total wait" value={totalWaitMs > 0 ? formatSpan(totalWaitMs) : "—"} />
          <Stat label="Messages" value={formatCount(messages.length)} />
        </div>

        <div className="flex flex-wrap justify-center gap-1.5 px-5 pt-4">
          <Button
            size="sm"
            icon={<PencilIcon size={14} />}
            locked={editLock}
            onClick={() => {
              setDraftName(person.nameOverride ?? "");
              setRenaming(true);
            }}
          >
            Rename
          </Button>
          {person.nameOverride ? (
            <Button
              size="sm"
              locked={editLock}
              loading={busy === "reset"}
              onClick={() => run("reset", () => change("person.update", { identity, displayName: null }))}
            >
              Reset name
            </Button>
          ) : null}
          {person.hasUploadedPhoto ? (
            <Button
              size="sm"
              locked={editLock}
              loading={busy === "photo"}
              onClick={() => run("photo", () => change("person.update", { identity, removePhoto: true }))}
            >
              Remove photo
            </Button>
          ) : null}
          {leavableRooms.length > 0 ? (
            <Button
              size="sm"
              icon={<RoomsIcon size={14} />}
              locked={membershipLock}
              loading={busy === "leaveAll"}
              onClick={async () => {
                const ok = await confirm({
                  title: `Remove ${person.name} from ${plural(leavableRooms.length, "room")}?`,
                  body: "They stop waiting everywhere except rooms they host. Their messages stay. You can undo this.",
                  confirmLabel: "Remove from all",
                  tone: "danger",
                });
                if (ok) await run("leaveAll", () => change("person.leaveAll", { identity }));
              }}
            >
              Remove from all rooms
            </Button>
          ) : null}
          {!role ? (
            person.suspended ? (
              <Button
                size="sm"
                icon={<CheckIcon size={14} />}
                locked={deny("people.suspend")}
                loading={busy === "suspend"}
                onClick={() => run("suspend", () => change("person.suspend", { identity, suspended: false }))}
              >
                Lift suspension
              </Button>
            ) : (
              <Button
                size="sm"
                variant="dangerGhost"
                icon={<BanIcon size={14} />}
                locked={deny("people.suspend")}
                loading={busy === "suspend"}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Suspend ${person.name}?`,
                    body: "They can still browse, but can't join rooms, chat, vote, check in or create rooms until you lift it. They're told right away. You can undo this.",
                    confirmLabel: "Suspend",
                    tone: "danger",
                  });
                  if (ok) await run("suspend", () => change("person.suspend", { identity, suspended: true }));
                }}
              >
                Suspend
              </Button>
            )
          ) : null}
        </div>

        {person.kind === "google" && person.email ? (
          <DashboardAccess email={person.email} name={person.name} suspended={person.suspended} />
        ) : null}

        <Section title="Rooms" count={rooms.length}>
          {rooms.length === 0 ? (
            <p className="px-1 text-[13px] text-white/40">Not in any rooms.</p>
          ) : (
            rooms.map((entry) => (
              <div key={entry.room.id} className="group flex items-center gap-3 rounded-[12px] px-2 py-2 transition-colors hover:bg-white/[0.035]">
                <button
                  type="button"
                  onClick={() => focusOn({ tab: "rooms", roomId: entry.room.id })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <RoomThumb room={entry.room} size={36} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium">{entry.room.name}</span>
                      {entry.isHost ? <Badge tone="blue">Host</Badge> : null}
                    </span>
                    <span className="flex items-center gap-1 truncate text-[11.5px] text-white/40">
                      joined {timeAgo(entry.joinedAt, now)}
                      {entry.mood ? ` · ${MOOD_EMOJI[entry.mood] ?? ""} ${entry.mood}` : ""}
                      {entry.country ? (
                        <>
                          {" · "}
                          <Flag code={entry.country} /> {getCountryName(entry.country)}
                        </>
                      ) : null}
                    </span>
                  </span>
                </button>
                <span className="hidden sm:block">
                  <StatusBadge room={entry.room} now={now} />
                </span>
                {entry.isHost || entry.room.trashedAt || membershipLock ? (
                  <span className="w-7" />
                ) : (
                  <IconButton
                    size="sm"
                    tone="danger"
                    label={`Remove from ${entry.room.name}`}
                    onClick={() => change("room.removePerson", { roomId: entry.room.id, identity })}
                  >
                    <XIcon size={14} />
                  </IconButton>
                )}
              </div>
            ))
          )}
        </Section>

        <Section title="Recent messages" count={messages.length}>
          {messages.length === 0 ? (
            <p className="px-1 text-[13px] text-white/40">No messages.</p>
          ) : (
            messages.slice(0, 20).map((message) => (
              <div key={message.id} className="group flex items-start gap-2.5 rounded-[12px] px-2 py-2 transition-colors hover:bg-white/[0.035]">
                <span className="mt-0.5 text-white/30">
                  <MessageIcon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.45] text-white/80">{message.text}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-white/35">
                    in {message.roomName} · {timeAgo(message.createdAt, now)}
                  </p>
                </div>
                {canDeleteMessages ? (
                  <IconButton
                    size="sm"
                    tone="danger"
                    label="Delete message"
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={() => change("chat.delete", { roomId: message.roomId, messageId: message.id })}
                  >
                    <TrashIcon size={14} />
                  </IconButton>
                ) : null}
              </div>
            ))
          )}
        </Section>

        <Section title="Details">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 px-1 text-[12.5px]">
            <dt className="text-white/40">Identity</dt>
            <dd className="truncate font-mono text-[12px] text-white/70">{person.identity}</dd>
            <dt className="text-white/40">First seen</dt>
            <dd className="text-white/70">{formatDate(person.firstSeenAt)}</dd>
            <dt className="text-white/40">Last active</dt>
            <dd className="text-white/70" title={formatDateTime(person.lastSeenAt)}>
              {person.lastSeenAt ? timeAgo(person.lastSeenAt, now) : "Not since this dashboard started tracking"}
            </dd>
          </dl>
        </Section>
      </div>
    );
  })();

  if (bare) {
    return (
      <div className="relative max-h-[80vh] overflow-y-auto pb-4">
        <div className="absolute right-3 top-3 z-10">
          <IconButton label="Close" onClick={onClose}>
            <XIcon size={16} />
          </IconButton>
        </div>
        {body}
      </div>
    );
  }

  return (
    <Card className="admin-scroll max-h-[calc(100vh-96px)] overflow-y-auto pb-4">
      <div className="absolute right-3 top-3 z-10">
        <IconButton label="Close" onClick={onClose}>
          <XIcon size={16} />
        </IconButton>
      </div>
      {body}
    </Card>
  );
}

/** Whether they can open the dashboard — and for the owner, the place to
 * make them an admin, change what they can do, or take it away. */
function DashboardAccess({ email, name, suspended }: { email: string; name: string; suspended: boolean }) {
  const { snapshot, me, deny, openAccess, change, confirm } = useAdmin();
  const [removing, setRemoving] = useState(false);
  const key = email.toLowerCase();
  const role = adminRoleOf(snapshot, key);
  const member = snapshot?.team.members.find((item) => item.email === key) ?? null;
  const isOwner = me.role === "owner";

  return (
    <Section title="Dashboard access">
      {role === "owner" ? (
        <div className="flex items-start gap-3 px-1">
          <span className="mt-0.5 text-[#fcd34d]">
            <CrownIcon size={16} />
          </span>
          <p className="text-[13px] leading-[1.5] text-white/60">
            <span className="font-medium text-white/85">Owner.</span> Full access, and the only one who can add or remove
            admins.
          </p>
        </div>
      ) : member ? (
        <div className="flex flex-col gap-3 px-1">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-[#c4b5fd]">
              <ShieldIcon size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] leading-[1.5] text-white/60">
                <span className="font-medium text-white/85">Admin · {describeAccess(member.permissions)}.</span>{" "}
                {member.permissions.length === 0
                  ? "Can look around the dashboard, but not change anything."
                  : member.permissions.length === ALL_PERMISSIONS.length
                    ? "Can change everything except who's an admin."
                    : `Can ${member.permissions.map(permissionPhrase).join(", ")}.`}
              </p>
            </div>
          </div>
          {isOwner ? (
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" icon={<PencilIcon size={14} />} onClick={() => openAccess({ mode: "edit", email: key })}>
                Edit access
              </Button>
              <Button
                size="sm"
                variant="dangerGhost"
                icon={<XIcon size={14} />}
                loading={removing}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Remove ${name} as an admin?`,
                    body: "They lose access to this dashboard straight away — if they have it open, it closes within seconds. You can undo this.",
                    confirmLabel: "Remove admin",
                    tone: "danger",
                  });
                  if (!ok) return;
                  setRemoving(true);
                  await change("admin.remove", { email: key });
                  setRemoving(false);
                }}
              >
                Remove admin
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-[13px] text-white/45">Not an admin.</p>
          <Button
            size="sm"
            icon={<UserPlusIcon size={14} />}
            locked={deny("owner") ?? (suspended ? "Lift their suspension before making them an admin." : null)}
            onClick={() => openAccess({ mode: "add", email: key })}
          >
            Make admin
          </Button>
        </div>
      )}
    </Section>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <div className="mt-5 border-t border-white/[0.06] px-4 pt-4">
      <p className="mb-2 px-1 text-[12px] font-medium uppercase tracking-[0.06em] text-white/35">
        {title}
        {count !== undefined ? <span className="ml-1.5 tabular-nums text-white/25">{count}</span> : null}
      </p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}
