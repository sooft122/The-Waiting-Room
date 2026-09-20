import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";

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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|images/).*)"],
};
