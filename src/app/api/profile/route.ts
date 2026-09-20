import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getOrCreateProfile, updateProfile } from "@/lib/profile";
import { maskEmail } from "@/lib/maskEmail";

// This route's response changes per-request (profile edits should be visible
// immediately), so opt out of every caching layer Next.js might otherwise
// apply to a GET route handler.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Base64 inflates raw bytes by ~4/3; this caps the *encoded* string length,
// corresponding to roughly a 3MB source image (smaller than room thumbnails
// since this is just a small circular avatar).
const MAX_AVATAR_DATA_URL_LENGTH = 4_200_000;

function resolveIdentity(sessionEmail: string | null | undefined, anonId: string | null) {
  if (sessionEmail) return { identity: sessionEmail, isAnonymous: false as const };
  if (anonId) return { identity: `anon:${anonId}`, isAnonymous: true as const };
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const anonId = headers().get("x-anon-id");
  const resolved = resolveIdentity(session?.user?.email, anonId);

  if (!resolved) {
    return NextResponse.json({ error: "No identity available." }, { status: 400 });
  }

  const profile = await getOrCreateProfile(resolved.identity, resolved.isAnonymous);

  const effectiveName = resolved.isAnonymous
    ? `Anonymous #${anonId}`
    : profile.displayName ?? session?.user?.name ?? "Waiting Room User";

  return NextResponse.json(
    {
      profile,
      effectiveName,
      effectiveAvatarUrl: resolved.isAnonymous ? null : profile.avatarUrl,
      email: session?.user?.email ? maskEmail(session.user.email) : null,
      isAnonymous: resolved.isAnonymous,
      anonId,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Only signed-in accounts can update their profile." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { displayName, avatarUrl } = (body ?? {}) as Record<string, unknown>;
  const updates: Partial<{ displayName: string; avatarUrl: string }> = {};

  if (displayName !== undefined) {
    if (typeof displayName !== "string" || !displayName.trim()) {
      return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    }
    if (displayName.trim().length > 40) {
      return NextResponse.json(
        { error: "Name must be 40 characters or fewer." },
        { status: 400 },
      );
    }
    updates.displayName = displayName.trim();
  }

  if (avatarUrl !== undefined) {
    if (typeof avatarUrl !== "string" || !avatarUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "A valid image is required." }, { status: 400 });
    }
    if (avatarUrl.length > MAX_AVATAR_DATA_URL_LENGTH) {
      return NextResponse.json(
        { error: "Image is too large — please use a file under 3MB." },
        { status: 400 },
      );
    }
    updates.avatarUrl = avatarUrl;
  }

  try {
    const profile = await updateProfile(session.user.email, updates);
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json(
      { error: "Profile storage isn't configured yet — Upstash Redis credentials are missing." },
      { status: 503 },
    );
  }
}
