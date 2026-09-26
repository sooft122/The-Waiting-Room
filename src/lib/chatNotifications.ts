/**
 * Rules for "new message" push notifications: who gets alerted, how often,
 * and what the alert says. Pure (no Redis, no web-push) so the browser can
 * share the constants and the server's decisions can be checked in isolation.
 */

/** A subscriber is alerted about a room's chat at most once per window —
 * unless they've been back to the room since their last alert, which resets
 * it (they caught up, so the next message is news again). */
export const CHAT_ALERT_WINDOW_MS = 5 * 60_000;

/** Someone whose room page reported itself visible this recently is looking
 * at the room right now — the chat's own unread dot already covers them. */
export const ROOM_VIEWING_FRESH_MS = 30_000;

/** How often an open, visible room page reports in (piggybacked on the chat
 * poll) — comfortably inside ROOM_VIEWING_FRESH_MS. */
export const ROOM_VIEWING_REPORT_MS = 10_000;

/** Request header the chat poll sets when it's reporting a visible page. */
export const ROOM_VIEWING_HEADER = "x-room-viewing";

// "N new messages" never looks back further than this, so the first alert in
// a long-quiet room doesn't count its whole history as new.
const NEW_MESSAGE_LOOKBACK_MS = 24 * 60 * 60_000;

const MAX_BODY_LENGTH = 140;

/** One tag per room, so a newer alert replaces the older one on the device
 * instead of stacking up. */
export function chatNotificationTag(roomId: string): string {
  return `room-chat:${roomId}`;
}

export type ChatAlertRecipient = {
  subscriptionId: string;
  /** Messages newer than this (ms) count toward "N new messages". */
  unreadSince: number;
};

export function pickChatAlertRecipients({
  subscribers,
  senderIdentity,
  lastViewedAt,
  lastAlertedAt,
  now,
}: {
  /** Subscription id → the identity that turned alerts on with it. */
  subscribers: Record<string, string>;
  senderIdentity: string;
  /** Identity → when their room page last reported itself visible (ms). */
  lastViewedAt: Record<string, number>;
  /** Subscription id → when it was last alerted about this room (ms). */
  lastAlertedAt: Record<string, number>;
  now: number;
}): ChatAlertRecipient[] {
  const recipients: ChatAlertRecipient[] = [];

  for (const [subscriptionId, identity] of Object.entries(subscribers)) {
    // Nobody gets alerted about their own message.
    if (identity === senderIdentity) continue;

    const viewedAt = lastViewedAt[identity] ?? 0;
    if (now - viewedAt < ROOM_VIEWING_FRESH_MS) continue;

    const alertedAt = lastAlertedAt[subscriptionId] ?? 0;
    const caughtUpSinceAlert = viewedAt > alertedAt;
    if (!caughtUpSinceAlert && now - alertedAt < CHAT_ALERT_WINDOW_MS) continue;

    recipients.push({
      subscriptionId,
      unreadSince: Math.max(alertedAt, viewedAt, now - NEW_MESSAGE_LOOKBACK_MS),
    });
  }

  return recipients;
}

/** How many of `messageTimes` (ms) are newer than `since` — at least 1, since
 * an alert only ever goes out for a message that just arrived. */
export function countNewMessages(messageTimes: number[], since: number): number {
  return Math.max(1, messageTimes.filter((time) => time > since).length);
}

export type ChatNotificationPayload = {
  title: string;
  body: string;
  tag: string;
  /** Same-origin path the notification opens when tapped. */
  url: string;
  /** When the newest message was sent (ms). */
  timestamp: number;
};

export function buildChatNotification({
  roomId,
  roomName,
  senderName,
  text,
  newMessages,
  sentAt,
}: {
  roomId: string;
  roomName: string;
  senderName: string;
  text: string;
  newMessages: number;
  sentAt: number;
}): ChatNotificationPayload {
  const line = `${senderName}: ${text}`;
  const count = newMessages > 99 ? "99+" : String(newMessages);

  return {
    title: newMessages > 1 ? `${count} new messages in ${roomName}` : roomName,
    body: line.length > MAX_BODY_LENGTH ? `${line.slice(0, MAX_BODY_LENGTH - 1).trimEnd()}…` : line,
    tag: chatNotificationTag(roomId),
    url: `/rooms/${roomId}`,
    timestamp: sentAt,
  };
}
