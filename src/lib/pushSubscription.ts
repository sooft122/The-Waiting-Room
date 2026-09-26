/** A browser's Web Push subscription, as stored and as handed to web-push. */
export type PushSubscriptionRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// Every major browser's push service lives on one of these: Google (Chrome,
// Edge on Android, Opera, Samsung), Mozilla (Firefox), Apple (Safari) and
// Windows (Edge on desktop). Anything else is refused — the server POSTs to
// this URL later, so an arbitrary one would let someone aim it anywhere.
const PUSH_SERVICE_HOSTS = ["fcm.googleapis.com", "android.googleapis.com"];
const PUSH_SERVICE_HOST_SUFFIXES = [".push.services.mozilla.com", ".push.apple.com", ".notify.windows.com"];

const MAX_ENDPOINT_LENGTH = 2048;
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_ENDPOINT_LENGTH) return false;
  try {
    const { protocol, hostname } = new URL(value);
    return (
      protocol === "https:" &&
      (PUSH_SERVICE_HOSTS.includes(hostname) ||
        PUSH_SERVICE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)))
    );
  } catch {
    return false;
  }
}

function isKey(value: unknown, minLength: number, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length >= minLength &&
    value.length <= maxLength &&
    BASE64URL.test(value)
  );
}

/** Validates what the browser sent up (PushSubscription.toJSON()). */
export function parsePushSubscription(raw: unknown): PushSubscriptionRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const { endpoint, keys } = raw as { endpoint?: unknown; keys?: unknown };
  if (!isPushEndpoint(endpoint) || !keys || typeof keys !== "object") return null;

  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  // p256dh is a 65-byte P-256 public key (87 base64url characters) and auth a
  // 16-byte secret (22) — with a little slack for padding.
  if (!isKey(p256dh, 80, 100) || !isKey(auth, 16, 30)) return null;

  return { endpoint, keys: { p256dh, auth } };
}
