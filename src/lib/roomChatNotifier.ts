import webpush from "web-push";
import { isRoomActive } from "./rooms";
import type { Room } from "./rooms";
import { getMessages } from "./roomChat";
import type { ChatMessage } from "./roomChat";
import { getPushConfig } from "./pushConfig";
import { buildChatNotification, countNewMessages, pickChatAlertRecipients } from "./chatNotifications";
import {
  forgetSubscription,
  getRoomAlertState,
  getRoomSubscribers,
  getSubscriptions,
  recordRoomAlerts,
} from "./roomPush";

// How long a push service holds an alert for a phone that's offline or asleep
// before dropping it — by then it's stale news anyway.
const ALERT_TTL_SECONDS = 6 * 60 * 60;
const SEND_TIMEOUT_MS = 10_000;

/** Alerts everyone else in the room who turned notifications on that a new
 * chat message arrived, throttled per person (see chatNotifications.ts).
 * Never throws — a failed alert mustn't fail the message that caused it. */
export async function notifyRoomChat(room: Room, message: ChatMessage): Promise<void> {
  const config = getPushConfig();
  if (!config || !isRoomActive(room)) return;

  try {
    const subscribers = await getRoomSubscribers(room.id);
    const identities = Array.from(new Set(Object.values(subscribers))).filter(
      (identity) => identity !== message.identity,
    );
    if (identities.length === 0) return;

    const now = Date.now();
    const { lastViewedAt, lastAlertedAt } = await getRoomAlertState(room.id, identities);
    const recipients = pickChatAlertRecipients({
      subscribers,
      senderIdentity: message.identity,
      lastViewedAt,
      lastAlertedAt,
      now,
    });
    if (recipients.length === 0) return;

    const subscriptionIds = recipients.map((recipient) => recipient.subscriptionId);
    const [subscriptions, recentMessages] = await Promise.all([
      getSubscriptions(subscriptionIds),
      getMessages(room.id, 100),
      recordRoomAlerts(room.id, subscriptionIds, now),
    ]);
    const messageTimes = recentMessages.map((recent) => Date.parse(recent.createdAt));

    await Promise.all(
      recipients.map(async (recipient, i) => {
        const subscription = subscriptions[i];
        if (!subscription) {
          await forgetSubscription(room.id, recipient.subscriptionId);
          return;
        }

        const payload = buildChatNotification({
          roomId: room.id,
          roomName: room.name,
          senderName: message.displayName,
          text: message.text,
          newMessages: countNewMessages(messageTimes, recipient.unreadSince),
          sentAt: Date.parse(message.createdAt),
        });

        try {
          await webpush.sendNotification(subscription, JSON.stringify(payload), {
            vapidDetails: config,
            TTL: ALERT_TTL_SECONDS,
            urgency: "normal",
            timeout: SEND_TIMEOUT_MS,
          });
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          // The browser dropped this subscription — notifications blocked,
          // site data cleared, or the Home Screen app removed.
          if (statusCode === 404 || statusCode === 410) {
            await forgetSubscription(room.id, recipient.subscriptionId);
          } else {
            console.warn("Chat alert failed to send", statusCode ?? error);
          }
        }
      }),
    );
  } catch (error) {
    console.warn("Chat alerts skipped", error);
  }
}
