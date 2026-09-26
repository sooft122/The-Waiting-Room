"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chatNotificationTag } from "@/lib/chatNotifications";
import {
  getPushRegistration,
  isPushSupported,
  needsHomeScreenForPush,
  subscribeToPush,
  subscriptionIdFor,
} from "@/lib/pushClient";

export type RoomNotificationStatus =
  /** Not offered: not joined, notifications not set up, or no web push in this browser. */
  | "unavailable"
  /** iPhone or iPad in a browser tab — the site has to be on the Home Screen first. */
  | "needs-home-screen"
  | "checking"
  | "off"
  | "on"
  /** Notifications are blocked for this site in the browser's settings. */
  | "blocked";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Whether this browser gets a push notification when someone posts in the
 * room's chat, plus the switch that turns that on and off. */
export function useRoomNotifications({
  roomId,
  hasJoined,
  publicKey,
}: {
  roomId: string;
  hasJoined: boolean;
  /** The server's VAPID public key — null when notifications aren't set up. */
  publicKey: string | null;
}) {
  // Starts "unavailable" on the server and first render alike (no browser
  // APIs there), then the effect below works out the real state.
  const [status, setStatus] = useState<RoomNotificationStatus>("unavailable");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const apiPath = `/api/rooms/${roomId}/notifications`;

  useEffect(() => {
    registrationRef.current = null;
    setError(null);
    if (!hasJoined || !publicKey) {
      setStatus("unavailable");
      return;
    }
    if (!isPushSupported()) {
      setStatus(needsHomeScreenForPush() ? "needs-home-screen" : "unavailable");
      return;
    }

    let cancelled = false;
    const settle = (next: RoomNotificationStatus) => {
      if (!cancelled) setStatus(next);
    };
    setStatus("checking");

    (async () => {
      // Registered up front (not on click) so a click can go straight to the
      // permission prompt — some browsers drop the prompt if the click
      // handler waits on anything slow first.
      let registration: ServiceWorkerRegistration;
      try {
        registration = await getPushRegistration();
      } catch {
        settle("unavailable");
        return;
      }
      if (cancelled) return;
      registrationRef.current = registration;

      if (Notification.permission === "denied") {
        settle("blocked");
        return;
      }
      try {
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription || Notification.permission !== "granted") {
          settle("off");
          return;
        }
        const subscriptionId = await subscriptionIdFor(subscription.endpoint);
        const response = await fetch(`${apiPath}?sub=${subscriptionId}`);
        const data = await response.json();
        settle(data.enabled ? "on" : "off");
      } catch {
        settle("off");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiPath, hasJoined, publicKey]);

  // Having the room open counts as reading it — clear its alerts from the
  // notification tray.
  useEffect(() => {
    if (status !== "on") return;

    const clearAlerts = () => {
      const registration = registrationRef.current;
      if (!registration || document.visibilityState !== "visible") return;
      registration
        .getNotifications({ tag: chatNotificationTag(roomId) })
        .then((notifications) => notifications.forEach((notification) => notification.close()))
        .catch(() => {});
    };

    clearAlerts();
    document.addEventListener("visibilitychange", clearAlerts);
    return () => document.removeEventListener("visibilitychange", clearAlerts);
  }, [status, roomId]);

  const toggle = useCallback(async () => {
    const registration = registrationRef.current;
    if (pending || !registration || !publicKey || (status !== "on" && status !== "off")) return;

    setPending(true);
    setError(null);
    try {
      if (status === "on") {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const response = await fetch(apiPath, {
            method: "DELETE",
            headers: JSON_HEADERS,
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          if (!response.ok) {
            setError("Couldn't turn notifications off — try again.");
            return;
          }
        }
        setStatus("off");
        return;
      }

      let subscription: PushSubscription;
      try {
        subscription = await subscribeToPush(registration, publicKey);
      } catch {
        // Blocked, prompt dismissed (nothing to say — they chose not to), or
        // the browser couldn't reach its push service.
        if (Notification.permission === "denied") setStatus("blocked");
        else if (Notification.permission === "granted") {
          setError("This browser couldn't set up notifications.");
        }
        return;
      }

      const response = await fetch(apiPath, {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Couldn't turn notifications on — try again.");
        return;
      }
      setStatus("on");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setPending(false);
    }
  }, [apiPath, pending, publicKey, status]);

  return { status, pending, error, toggle };
}
