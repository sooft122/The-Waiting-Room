import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { getToken } from "next-auth/jwt";
import { SUSPENDED_IDENTITIES_KEY, SUSPENDED_MESSAGE } from "@/lib/suspensionShared";

const ANON_COOKIE = "anon_id";
const ANON_HEADER = "x-anon-id";
const ANON_COUNTER_KEY = "waiting-room:anon-counter";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

let redis: Redis | null = null;
try {
  redis = Redis.fromEnv();
} catch {
  // UPSTASH_REDIS_REST_URL / _TOKEN not set — anonymous numbering is
  // disabled and the UI falls back to a generic label instead of crashing.
  redis = null;
}

/** A request that changes something (joining, chatting, voting, creating…),
 * as opposed to one that only reads. Signing in and out always works, and
 * the admin dashboard's own API checks its own access. */
function isWriteRequest(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return false;
  }
  return (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/") &&
    !pathname.startsWith("/api/admin")
  );
}

/** Whether the admin has suspended whoever is making this request — checked
 * under both their Google account and the Anonymous number their browser
 * carries, so signing in or out doesn't get around it. */
async function isSuspended(request: NextRequest, anonId: string | undefined): Promise<boolean> {
  if (!redis) return false;
  const identities: string[] = [];
  if (anonId) identities.push(`anon:${anonId}`);
  try {
    const token = await getToken({ req: request });
    if (typeof token?.email === "string") identities.push(token.email);
  } catch {
    // Unreadable session cookie — fall back to the anonymous identity alone.
  }
  if (identities.length === 0) return false;
  try {
    const flags = await redis.smismember(SUSPENDED_IDENTITIES_KEY, identities);
    return flags.some((flag) => flag === 1);
  } catch {
    // Redis unreachable — don't block anyone over it.
    return false;
  }
}

/**
 * Assigns each first-time visitor a permanent, never-reused sequence number
 * (Anonymous #1, #2, #3, ...) via an atomic Redis INCR, and remembers it in
 * a cookie so the same visitor keeps their number on return visits. Because
 * the counter only ever increments — nothing decrements it when someone
 * signs in — a number is never handed out twice, even after its original
 * holder creates a real account.
 */
export async function middleware(request: NextRequest) {
  let anonId = request.cookies.get(ANON_COOKIE)?.value;
  let shouldPersistCookie = false;

  if (!anonId && redis) {
    try {
      const nextId = await redis.incr(ANON_COUNTER_KEY);
      anonId = String(nextId);
      shouldPersistCookie = true;

      // Record this visitor's join moment for their profile page. Uses the
      // same set-if-not-exists shape as lib/profile.ts's getOrCreateProfile
      // (duplicated here since middleware runs on the Edge runtime, kept in
      // sync manually — both must stay set-if-not-exists, never overwrite).
      await redis.set(
        `waiting-room:users:anon:${anonId}`,
        {
          identity: `anon:${anonId}`,
          displayName: null,
          avatarUrl: null,
          joinedAt: new Date().toISOString(),
          isAnonymous: true,
        },
        { nx: true },
      );
    } catch {
      // Redis unreachable — proceed without an id this request.
    }
  }

  // Suspended people can still look around; every change they try is refused here.
  if (isWriteRequest(request) && (await isSuspended(request, anonId))) {
    return NextResponse.json({ error: SUSPENDED_MESSAGE, suspended: true }, { status: 403 });
  }

  const requestHeaders = new Headers(request.headers);
  if (anonId) {
    requestHeaders.set(ANON_HEADER, anonId);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (shouldPersistCookie && anonId) {
    response.cookies.set(ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: ONE_YEAR_SECONDS,
      path: "/",
    });
  }

  return response;
}

// Static files are skipped: there's no visitor to set up for them, and one
// fetched in the background without cookies (the manifest or service worker,
// say) would otherwise be handed a brand new Anonymous number. So is the
// site-state check every open page makes every few seconds (api/site) — it's
// the same for everyone, and skipping this lets the CDN answer it.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|images/|manifest.webmanifest|sw.js|apple-icon|api/site).*)",
  ],
};
