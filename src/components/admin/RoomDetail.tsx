"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminMessage, AdminRoomDetail } from "@/lib/admin/types";
import { getCountryName } from "@/lib/countries";
import { useAdmin } from "./AdminContext";
import Flag from "./Flag";
import { MOOD_EMOJI, formatDateTime, formatSpan, plural, timeAgo } from "./format";
import { LockIcon, MessageIcon, SendIcon, TrashIcon, UsersIcon, XIcon } from "./icons";
import { Avatar, Badge, Button, EmptyState, IconButton, Segmented, Skeleton, cx } from "./ui";
import { useLatest } from "./useLatest";

const DETAIL_POLL_MS = 8000;

type Pane = "people" | "chat" | "insights";

/** The expanded view of one room: who's in it, its chat, and its mood and
 * countries — kept live while open. */
export default function RoomDetail({ roomId, initialPane = "people" }: { roomId: string; initialPane?: Pane }) {
  const { call, change, confirm, changeCount, focusOn, now, snapshot, me, can } = useAdmin();
  const [detail, setDetail] = useState<AdminRoomDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>(initialPane);

  const fetchDetail = useCallback(() => call<AdminRoomDetail>("room.get", { id: roomId }), [call, roomId]);
  const applyDetail = useCallback((next: AdminRoomDetail) => {
    setDetail(next);
    setError(null);
  }, []);
  const detailFailed = useCallback(
    (err: unknown) => setError(err instanceof Error ? err.message : "Couldn't load this room."),
    [],
  );
  const load = useLatest(fetchDetail, applyDetail, detailFailed);

  useEffect(() => {
    void load();
  }, [load, changeCount]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, DETAIL_POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (error && !detail) {
    return <p className="px-5 py-6 text-[13px] text-[#ff9a9d]">{error}</p>;
  }
  if (!detail) {
    return (
      <div className="flex flex-col gap-2 px-5 py-5">
        <Skeleton className="h-9 w-[280px]" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const { room, participants, messages } = detail;
  // Taking an admin out of a room is the owner's call (the API agrees).
  const canRemove = (identity: string) => {
    if (!can("rooms.people")) return false;
    if (me.role === "owner" || identity.toLowerCase() === me.email.toLowerCase()) return true;
    const key = identity.toLowerCase();
    return !snapshot?.team.owners.includes(key) && !snapshot?.team.members.some((member) => member.email === key);
  };

  return (
    <div className="animate-admin-rise flex flex-col gap-4 px-4 pb-5 pt-1 sm:px-5">
      <Segmented
        size="sm"
        value={pane}
        onChange={setPane}
        ariaLabel="Room details"
        options={[
          { value: "people", label: "People", icon: <UsersIcon size={14} />, count: participants.length },
          { value: "chat", label: "Chat", icon: <MessageIcon size={14} />, count: messages.length },
          { value: "insights", label: "Mood & places" },
        ]}
      />

      {pane === "people" ? (
        participants.length === 0 ? (
          <EmptyState icon={<UsersIcon size={18} />} title="Nobody's waiting here yet" className="py-8" />
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-white/[0.06]">
            {participants.map((person, i) => (
              <div
                key={person.identity}
                className={cx(
                  "group flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-white/[0.03]",
                  i > 0 && "border-t border-white/[0.05]",
                )}
              >
                <button
                  type="button"
                  onClick={() => focusOn({ tab: "people", identity: person.identity })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Avatar name={person.name} image={person.image} size={30} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium">{person.name}</span>
                      {person.isHost ? <Badge tone="blue">Host</Badge> : null}
                      {person.suspended ? <Badge tone="red">Suspended</Badge> : null}
                    </span>
                    <span className="block truncate text-[12px] text-white/40">
                      {person.kind === "google" ? person.identity : "Anonymous visitor"} · joined{" "}
                      {timeAgo(person.joinedAt, now)}
                    </span>
                  </span>
                </button>
                <div className="hidden shrink-0 items-center gap-3 text-[12.5px] text-white/50 md:flex">
                  {person.mood ? (
                    <span title={`Mood: ${person.mood}`}>
                      {MOOD_EMOJI[person.mood] ?? "•"} {person.mood}
                    </span>
                  ) : null}
                  {person.country ? <Flag code={person.country} /> : null}
                  {person.messageCount > 0 ? <span>{plural(person.messageCount, "message")}</span> : null}
                  {person.lastCheckIn ? <span title={formatDateTime(person.lastCheckIn)}>seen {timeAgo(person.lastCheckIn, now)}</span> : null}
                </div>
                {person.isHost || !canRemove(person.identity) ? (
                  <span className="w-8" />
                ) : (
                  <IconButton
                    label={`Remove ${person.name} from this room`}
                    tone="danger"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Remove ${person.name}?`,
                        body: `They'll stop waiting in “${room.name}”, and their mood and check-ins leave with them. Their messages stay. You can undo this.`,
                        confirmLabel: "Remove",
                        tone: "danger",
                      });
                      if (ok) await change("room.removePerson", { roomId: room.id, identity: person.identity });
                    }}
                  >
                    <XIcon size={15} />
                  </IconButton>
                )}
              </div>
            ))}
          </div>
        )
      ) : null}

      {pane === "chat" ? <ChatPane roomId={room.id} roomName={room.name} messages={messages} trashed={!!room.trashedAt} /> : null}

      {pane === "insights" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-[14px] border border-white/[0.06] p-4">
            <p className="text-[12.5px] font-medium text-white/60">Mood</p>
            {detail.moods.length === 0 ? (
              <p className="mt-2 text-[13px] text-white/40">No votes yet.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2.5">
                {detail.moods.map(({ mood, count }) => {
                  const total = detail.moods.reduce((sum, item) => sum + item.count, 0);
                  const percent = Math.round((count / total) * 100);
                  return (
                    <div key={mood} className="flex items-center gap-3 text-[13px]">
                      <span className="w-[110px] shrink-0">
                        {MOOD_EMOJI[mood] ?? "•"} {mood}
                      </span>
                      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <span className="absolute inset-y-0 left-0 rounded-full bg-white/70" style={{ width: `${percent}%` }} />
                      </span>
                      <span className="w-10 text-right tabular-nums text-white/50">{percent}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="rounded-[14px] border border-white/[0.06] p-4">
            <p className="text-[12.5px] font-medium text-white/60">Waiting from</p>
            {detail.countries.length === 0 ? (
              <p className="mt-2 text-[13px] text-white/40">No countries recorded yet.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {detail.countries.slice(0, 8).map(({ code, count }) => (
                  <div key={code} className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2">
                      <Flag code={code} /> {getCountryName(code)}
                    </span>
                    <span className="tabular-nums text-white/50">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-[14px] border border-white/[0.06] p-4 text-[13px] text-white/55 md:col-span-2">
            Created {formatDateTime(room.createdAt)} by {room.createdByLabel}
            {room.createdByCountry ? (
              <>
                {" "}
                <Flag code={room.createdByCountry} />
              </>
            ) : null}{" "}
            ·{" "}
            {Date.parse(room.endsAt) > now
              ? `ends in ${formatSpan(Date.parse(room.endsAt) - now)}`
              : `ended ${timeAgo(room.endsAt, now)}`}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChatPane({
  roomId,
  roomName,
  messages,
  trashed,
}: {
  roomId: string;
  roomName: string;
  messages: AdminMessage[];
  trashed: boolean;
}) {
  const { change, confirm, focusOn, now, can, deny } = useAdmin();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  useEffect(() => {
    if (messages.length !== lastCount.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    lastCount.current = messages.length;
  }, [messages.length]);

  async function post() {
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    const result = await change("chat.post", { roomId, text });
    setPosting(false);
    if (result) setDraft("");
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.length === 0 ? (
        <EmptyState icon={<MessageIcon size={18} />} title="No messages yet" className="py-8" />
      ) : (
        <div
          ref={listRef}
          className="admin-scroll max-h-[340px] overflow-y-auto rounded-[14px] border border-white/[0.06]"
        >
          {messages.map((message, i) => (
            <div
              key={message.id}
              className={cx(
                "group flex items-start gap-3 px-3.5 py-2.5 transition-colors hover:bg-white/[0.03]",
                i > 0 && "border-t border-white/[0.05]",
              )}
            >
              <span className="mt-[7px] size-2 shrink-0 rounded-full" style={{ background: message.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  {message.kind === "system" ? (
                    <span className="text-[13px] font-medium">{message.displayName}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => focusOn({ tab: "people", identity: message.identity })}
                      className="text-[13px] font-medium hover:underline"
                    >
                      {message.displayName}
                    </button>
                  )}
                  <span className="text-[11.5px] text-white/35" title={formatDateTime(message.createdAt)}>
                    {timeAgo(message.createdAt, now)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.5] text-white/75">{message.text}</p>
              </div>
              {can("chat.moderate") ? (
                <IconButton
                  label="Delete message"
                  tone="danger"
                  size="sm"
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={() => change("chat.delete", { roomId, messageId: message.id })}
                >
                  <TrashIcon size={14} />
                </IconButton>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {trashed ? (
        <p className="text-[12.5px] text-white/40">Restore the room to post in its chat.</p>
      ) : !can("chat.post") ? (
        <p className="flex items-center gap-2 text-[12.5px] text-white/40">
          <LockIcon size={13} />
          {deny("chat.post")}
        </p>
      ) : (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void post();
          }}
        >
          <input
            value={draft}
            maxLength={300}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Post as The Waiting Room…"
            className="h-9 min-w-0 flex-1 rounded-[11px] border border-white/[0.08] bg-white/[0.035] px-3 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-[#8fb2ff]/55 focus:shadow-[0_0_0_4px_rgba(143,178,255,0.12)]"
          />
          <Button variant="primary" loading={posting} disabled={!draft.trim()} type="submit" icon={<SendIcon size={14} />}>
            Post
          </Button>
        </form>
      )}

      {messages.length > 0 ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="dangerGhost"
            icon={<TrashIcon size={14} />}
            locked={deny("chat.moderate")}
            onClick={async () => {
              const ok = await confirm({
                title: "Clear the whole chat?",
                body: `All ${plural(messages.length, "message")} in “${roomName}” disappear for everyone. You can undo this from the toast or the Activity tab.`,
                confirmLabel: "Clear chat",
                tone: "danger",
              });
              if (ok) await change("chat.clear", { roomId });
            }}
          >
            Clear chat
          </Button>
        </div>
      ) : null}
    </div>
  );
}
