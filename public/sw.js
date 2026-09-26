// The Waiting Room's service worker — it only handles push notifications.
// There's deliberately no fetch handler: it never touches page loads or
// caching, it just shows alerts the server sends and opens the room on tap.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function isSameOriginPath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const tag = typeof payload.tag === "string" && payload.tag ? payload.tag : undefined;

  // Browsers require every push to show a notification, so there's always a
  // fallback title and body.
  event.waitUntil(
    self.registration.showNotification(
      typeof payload.title === "string" && payload.title ? payload.title : "The Waiting Room",
      {
        body: typeof payload.body === "string" ? payload.body : "There's something new in one of your rooms.",
        tag,
        // A replacement for an older alert from the same room still buzzes.
        renotify: Boolean(tag),
        icon: "/icons/app-192.png",
        badge: "/icons/notification-badge.png",
        timestamp: typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
        data: { url: isSameOriginPath(payload.url) ? payload.url : "/" },
      },
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data && event.notification.data.url;
  const target = new URL(isSameOriginPath(path) ? path : "/", self.location.origin);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const alreadyOpen = windows.find((client) => new URL(client.url).pathname === target.pathname);
      if (alreadyOpen) return alreadyOpen.focus();
      return self.clients.openWindow(target.href);
    })(),
  );
});
