/** Browser-side Web Push helpers — only call these from client code. */

const SERVICE_WORKER_URL = "/sw.js";
// A worker that fails to install never becomes "ready" — don't wait forever.
const READY_TIMEOUT_MS = 10_000;

/** Whether this browser can receive web push at all. */
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhones and iPads only offer web push to sites added to the Home Screen
 * (iOS 16.4+); in a normal browser tab the APIs aren't there at all. */
export function needsHomeScreenForPush(): boolean {
  const userAgent = navigator.userAgent;
  const isAppleMobile =
    /iPhone|iPad|iPod/.test(userAgent) ||
    // iPadOS asks for desktop sites, so it reports itself as a Mac — with a touch screen.
    (userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const isHomeScreenApp =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isAppleMobile && !isHomeScreenApp;
}

/** Registers the push service worker (a no-op if it already is) and waits
 * until it's active, which subscribing requires. */
export async function getPushRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The service worker didn't start.")), READY_TIMEOUT_MS);
    navigator.serviceWorker.ready.then((registration) => {
      clearTimeout(timer);
      resolve(registration);
    });
  });
}

// The VAPID public key arrives as URL-safe base64; the Push API wants bytes.
function base64UrlToBytes(value: string) {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Subscribes this browser to push, asking for notification permission if it
 * hasn't been given yet. Call straight from a click — browsers only show the
 * permission prompt in response to one. */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
  publicKey: string,
): Promise<PushSubscription> {
  const options = { userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) };
  try {
    return await registration.pushManager.subscribe(options);
  } catch (error) {
    // A leftover subscription made with a different key blocks a new one —
    // replace it.
    if (!(error instanceof DOMException && error.name === "InvalidStateError")) throw error;
    const existing = await registration.pushManager.getSubscription();
    if (!existing) throw error;
    await existing.unsubscribe();
    return registration.pushManager.subscribe(options);
  }
}

/** The id the server uses for a subscription (roomPush.ts subscriptionIdFor):
 * the SHA-256 of its endpoint, in hex. */
export async function subscriptionIdFor(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
