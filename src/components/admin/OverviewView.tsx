"use client";

import { useMemo, type ReactNode } from "react";
import { useAdmin } from "./AdminContext";
import { LogRow } from "./ActivityView";
import { formatCount, isLive, plural, roomStatus, timeAgo } from "./format";
import { ActivityIcon, ExternalIcon, MessageIcon, PlusIcon, RoomsIcon, UserIcon, UsersIcon } from "./icons";
import { RoomThumb, StatusBadge } from "./RoomsView";
import { RefreshEveryoneButton, RoomCreationCard } from "./SettingsView";
import { Avatar, Button, Card, CardHeader, EmptyState, Skeleton } from "./ui";

function Kpi({ label, value, foot, icon }: { label: string; value: string | null; foot: ReactNode; icon: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-white/50">{label}</span>
        <span className="text-white/30">{icon}</span>
      </div>
      {value === null ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className="mt-2 text-[30px] font-semibold tabular-nums tracking-[-0.03em]">{value}</p>
      )}
      <p className="mt-1 text-[12.5px] text-white/40">{foot}</p>
    </Card>
  );
}

export default function OverviewView() {
  const { snapshot, people, now, setTab, openEditor, focusOn, deny } = useAdmin();

  const stats = useMemo(() => {
    if (!snapshot) return null;
    const rooms = snapshot.rooms.filter((room) => !room.trashedAt);
    const live = rooms.filter((room) => isLive(room, now));
    return {
      live: live.length,
      endingSoon: live.filter((room) => roomStatus(room, now) === "soon").length,
      waiting: live.reduce((sum, room) => sum + room.participantCount, 0),
      messages: rooms.reduce((sum, room) => sum + room.messageCount, 0),
      chattyRooms: rooms.filter((room) => room.messageCount > 0).length,
      topRooms: [...live].sort((a, b) => b.participantCount - a.participantCount).slice(0, 5),
    };
  }, [snapshot, now]);

  const peopleStats = useMemo(() => {
    if (!people) return null;
    const accounts = people.filter((person) => person.kind === "google");
    const anonymous = people.filter((person) => person.kind === "anonymous");
    return {
      accounts: accounts.length,
      activeAnonymous: anonymous.filter((person) => person.roomsJoined > 0).length,
      anonymous: anonymous.length,
      newest: [...accounts]
        .sort((a, b) => (b.lastSeenAt ?? b.firstSeenAt ?? "").localeCompare(a.lastSeenAt ?? a.firstSeenAt ?? ""))
        .slice(0, 5),
    };
  }, [people]);

  const recent = (snapshot?.log ?? []).slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          label="Live rooms"
          icon={<RoomsIcon size={16} />}
          value={stats ? formatCount(stats.live) : null}
          foot={stats ? (stats.endingSoon ? `${stats.endingSoon} ending within a day` : "None ending today") : "…"}
        />
        <Kpi
          label="People waiting"
          icon={<UsersIcon size={16} />}
          value={stats ? formatCount(stats.waiting) : null}
          foot={stats ? `across ${plural(stats.live, "live room")}` : "…"}
        />
        <Kpi
          label="Accounts"
          icon={<UserIcon size={16} />}
          value={peopleStats ? formatCount(peopleStats.accounts) : null}
          foot={
            peopleStats
              ? `+ ${formatCount(peopleStats.activeAnonymous)} active anonymous · ${formatCount(peopleStats.anonymous)} visitors`
              : "…"
          }
        />
        <Kpi
          label="Messages"
          icon={<MessageIcon size={16} />}
          value={stats ? formatCount(stats.messages) : null}
          foot={stats ? `in ${plural(stats.chattyRooms, "room")}` : "…"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RoomCreationCard />
        <Card className="p-5 sm:p-6">
          <CardHeader title="Quick actions" subtitle="The things you'll reach for most. Press ⌘K for everything else." />
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="primary"
              icon={<PlusIcon size={15} />}
              locked={deny("rooms.create")}
              onClick={() => openEditor("new")}
            >
              New room
            </Button>
            <RefreshEveryoneButton />
            <Button icon={<UsersIcon size={15} />} onClick={() => setTab("people")}>
              Browse people
            </Button>
            <Button icon={<ExternalIcon size={15} />} onClick={() => window.open("/", "_blank", "noopener")}>
              Open the site
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-3 sm:p-4">
          <CardHeader
            className="px-2 pb-2 pt-1"
            title="Recent changes"
            subtitle="Undo anything with one click."
            action={
              <Button size="sm" variant="ghost" onClick={() => setTab("activity")}>
                View all
              </Button>
            }
          />
          {!snapshot ? (
            <div className="flex flex-col gap-2 p-2">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
          ) : recent.length === 0 ? (
            <EmptyState icon={<ActivityIcon size={18} />} title="Nothing yet" body="Changes you make show up here." className="py-8" />
          ) : (
            recent.map((entry) => <LogRow key={entry.id} entry={entry} compact />)
          )}
        </Card>

        <Card className="p-3 sm:p-4">
          <CardHeader
            className="px-2 pb-2 pt-1"
            title="Most waited-for"
            subtitle="Live rooms with the most people in them."
            action={
              <Button size="sm" variant="ghost" onClick={() => setTab("rooms")}>
                All rooms
              </Button>
            }
          />
          {!stats ? (
            <div className="flex flex-col gap-2 p-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : stats.topRooms.length === 0 ? (
            <EmptyState icon={<RoomsIcon size={18} />} title="No live rooms" className="py-8" />
          ) : (
            stats.topRooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => focusOn({ tab: "rooms", roomId: room.id })}
                className="flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.035]"
              >
                <RoomThumb room={room} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{room.name}</span>
                  <span className="block truncate text-[12px] text-white/40">
                    {plural(room.participantCount, "person", "people")} · {plural(room.messageCount, "message")}
                  </span>
                </span>
                <StatusBadge room={room} now={now} />
              </button>
            ))
          )}
        </Card>
      </div>

      <Card className="p-3 sm:p-4">
        <CardHeader
          className="px-2 pb-2 pt-1"
          title="Recently active accounts"
          subtitle="Google accounts, most recently seen first."
          action={
            <Button size="sm" variant="ghost" onClick={() => setTab("people")}>
              Everyone
            </Button>
          }
        />
        {!peopleStats ? (
          <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-5">
            {peopleStats.newest.map((person) => (
              <button
                key={person.identity}
                type="button"
                onClick={() => focusOn({ tab: "people", identity: person.identity })}
                className="flex items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.035]"
              >
                <Avatar name={person.name} image={person.image} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{person.name}</span>
                  <span className="block truncate text-[11.5px] text-white/40">
                    {timeAgo(person.lastSeenAt ?? person.firstSeenAt, now)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
