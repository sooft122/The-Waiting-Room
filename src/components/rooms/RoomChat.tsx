"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type ChatMessage = {
  id: string;
  identity: string;
  displayName: string;
  color: string;
  text: string;
  createdAt: string;
};

type RoomChatProps = {
  roomId: string;
  hasJoined: boolean;
};

const OPEN_POLL_INTERVAL_MS = 2000;
// Slower while closed — still fast enough that the unread dot shows up
// promptly, without polling a chat nobody's currently looking at as often.
const CLOSED_POLL_INTERVAL_MS = 6000;
const AUTO_CLOSE_DELAY_MS = 7000;
const MAX_MESSAGE_LENGTH = 300;
const SEEN_STORAGE_KEY_PREFIX = "waiting-room:chat-last-seen:";

// Shared transition so the icon and panel feel like one fluid piece — the
// panel grows from the same bottom-right corner the icon sits in (matching
// transform-origin below), rather than just fading in place.
const TRANSITION_CLASS = "transition-[opacity,transform] duration-300 ease-out";

export default function RoomChat({ roomId, hasJoined }: RoomChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // The id of the newest message the viewer has actually had the panel open
  // for — null until read from localStorage (after mount, to avoid an SSR
  // hydration mismatch), so the badge stays hidden rather than flashing on
  // for a first render's worth of "unknown".
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(null);
  const [lastSeenHydrated, setLastSeenHydrated] = useState(false);

  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const listRef = useRef<HTMLDivElement>(null);
  const seenStorageKey = `${SEEN_STORAGE_KEY_PREFIX}${roomId}`;

  useEffect(() => {
    try {
      setLastSeenMessageId(window.localStorage.getItem(seenStorageKey));
    } catch {
      // Storage unavailable (private browsing, quota) — badge just won't persist across reloads.
    } finally {
      setLastSeenHydrated(true);
    }
  }, [seenStorageKey]);

  const markSeen = useCallback(
    (messageId: string) => {
      setLastSeenMessageId(messageId);
      try {
        window.localStorage.setItem(seenStorageKey, messageId);
      } catch {
        // Non-fatal — the dot may reappear next visit, nothing breaks.
      }
    },
    [seenStorageKey],
  );

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const handleMouseLeave = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), AUTO_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const toggleOpen = useCallback(() => {
    clearCloseTimer();
    setOpen((current) => !current);
  }, [clearCloseTimer]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  // Keeps polling even while closed (just slower) so a new message can still
  // light up the unread dot on the icon — the whole point of the dot is to
  // surface activity you'd otherwise only learn about by opening the panel.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/rooms/${roomId}/chat`);
        const data = await response.json();
        if (cancelled) return;
        if (Array.isArray(data.messages)) setMessages(data.messages);
        if (typeof data.cooldownRemainingMs === "number") {
          setCooldownUntil(data.cooldownRemainingMs > 0 ? Date.now() + data.cooldownRemainingMs : null);
        }
      } catch {
        // Transient — the next poll tick will retry.
      }
    }

    poll();
    const id = setInterval(poll, open ? OPEN_POLL_INTERVAL_MS : CLOSED_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, roomId]);

  // Whenever the panel is open, the newest loaded message counts as read —
  // covers both opening on an existing backlog and new messages streaming
  // in via polling while you're already looking at it.
  useEffect(() => {
    if (!open) return;
    const latest = messages[messages.length - 1];
    if (latest && latest.id !== lastSeenMessageId) markSeen(latest.id);
  }, [open, messages, lastSeenMessageId, markSeen]);

  // Ticks the displayed "Send in Ns" countdown once a second.
  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  // Auto-scroll to the newest message when the list grows or the panel opens.
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const remainingSeconds = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;
  const canSend = hasJoined && !sending && remainingSeconds <= 0 && text.trim().length > 0;

  const latestMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
  const hasUnread =
    !open && lastSeenHydrated && latestMessageId !== null && latestMessageId !== lastSeenMessageId;

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!hasJoined || sending || remainingSeconds > 0 || !trimmed) return;

    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${roomId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not send that.");
        if (typeof data.retryAfterMs === "number") {
          setCooldownUntil(Date.now() + data.retryAfterMs);
        }
        return;
      }
      setText("");
      setMessages((prev) => [...prev, data.message].slice(-100));
      setCooldownUntil(Date.now() + (data.cooldownMs ?? 10_000));
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Closed state: a small round icon, fixed in place like the search
          bar elsewhere in this app — always reachable regardless of scroll.
          The badge lives outside the button so the button's own
          overflow-hidden (needed to keep the icon glyph circular) doesn't
          clip it — it's meant to overlap the rim, not sit inset from it. */}
      <div
        className={`fixed bottom-6 right-5 z-30 origin-bottom-right ${TRANSITION_CLASS} ${
          open ? "pointer-events-none scale-75 opacity-0" : "scale-100 opacity-100"
        } sm:right-8 lg:right-10`}
      >
        <button
          type="button"
          onClick={toggleOpen}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-label={open ? "Close chat" : "Open chat"}
          className="relative flex size-[50px] items-center justify-center overflow-hidden rounded-full shadow-[0px_4px_27px_0px_rgba(0,0,0,0.18)] active:scale-95"
          style={{ backgroundImage: "linear-gradient(180deg, #252628, #18191b)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="size-6" src="/icons/message-01.svg" />
        </button>
        {hasUnread ? (
          <span
            aria-hidden
            className="chat-unread-dot pointer-events-none absolute -right-0.5 -top-0.5 size-[13px] rounded-full border-2 bg-red-500"
            style={{ borderColor: "#0c0d10" }}
          />
        ) : null}
      </div>

      {/* Open state: message list + composer, growing out of the same
          bottom-right corner the icon sits in. */}
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed bottom-6 right-5 z-30 w-[calc(100vw-40px)] max-w-[420px] origin-bottom-right sm:right-8 lg:right-10 ${TRANSITION_CLASS} ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-95 opacity-0"
        }`}
      >
        <div
          className="flex max-h-[70vh] flex-col justify-end gap-[18px] overflow-hidden rounded-[20px] p-4"
          style={{ backgroundImage: "linear-gradient(to bottom, rgba(12,13,16,0), #0c0d10 55%)" }}
        >
          <div
            ref={listRef}
            className="flex max-h-[320px] flex-col gap-[9px] overflow-y-auto font-satoshi text-[12px] leading-normal"
          >
            {messages.length === 0 ? (
              <p className="text-white/40">No messages yet — say something.</p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex flex-wrap items-baseline gap-1">
                  <span className="shrink-0 font-medium" style={{ color: message.color }}>
                    {message.displayName}:
                  </span>
                  <span className="break-words text-white">{message.text}</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-1">
            <input
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={!hasJoined}
              placeholder={hasJoined ? "What's on your mind?" : "Join the room to chat"}
              maxLength={MAX_MESSAGE_LENGTH}
              className="h-12 flex-1 rounded-[10px] border border-[rgba(227,221,221,0.4)] bg-[#202021] px-3.5 font-figtree text-[14px] text-white placeholder:text-white/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="relative flex h-12 w-[100px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-[10px] p-px shadow-[0px_1px_4px_0px_rgba(0,0,0,0.2)] disabled:cursor-default"
            >
              <span
                className="relative flex size-full items-center justify-center overflow-hidden rounded-[9px]"
                style={{
                  backgroundImage:
                    remainingSeconds > 0
                      ? "linear-gradient(181.39deg, rgba(228,221,221,0.1) 19.37%, rgba(220,220,220,0.1) 40.857%, rgba(216,213,213,0.1) 65.087%, rgba(209,209,209,0.1) 97.546%)"
                      : "linear-gradient(181.39deg, rgb(228,221,221) 19.37%, rgb(220,220,220) 40.857%, rgb(216,213,213) 65.087%, rgb(209,209,209) 97.546%)",
                  backgroundColor: remainingSeconds > 0 ? "rgba(255,255,255,0.4)" : undefined,
                }}
              >
                <span
                  className="relative font-figtree text-[14px] font-medium"
                  style={{ color: remainingSeconds > 0 ? "#252525" : "#000" }}
                >
                  {remainingSeconds > 0 ? `Send in ${remainingSeconds}s` : "Send"}
                </span>
              </span>
            </button>
          </form>

          {error ? <p className="font-inter text-[11px] text-red-400">{error}</p> : null}
        </div>
      </div>
    </>
  );
}
