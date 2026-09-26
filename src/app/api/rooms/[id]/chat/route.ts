import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getRoom, hasJoinedRoom } from "@/lib/rooms";
import { getOrCreateProfile } from "@/lib/profile";
import { getCooldownRemainingMs, getMessages, sendMessage, toPublicMessage } from "@/lib/roomChat";

export const dynamic = "force-dynamic";

function resolveIdentity(sessionEmail: string | null | undefined, anonId: string | null) {
  if (sessionEmail) return { identity: sessionEmail, isAnonymous: false as const };
  if (anonId) return { identity: `anon:${anonId}`, isAnonymous: true as const };
  return null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const anonId = headers().get("x-anon-id");
  const resolved = resolveIdentity(session?.user?.email, anonId);

  const [messages, cooldownRemainingMs] = await Promise.all([
    getMessages(params.id),
    resolved ? getCooldownRemainingMs(params.id, resolved.identity) : Promise.resolve(0),
  ]);

  return NextResponse.json(
    { messages: messages.map(toPublicMessage), cooldownRemainingMs },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const anonId = headers().get("x-anon-id");
  const resolved = resolveIdentity(session?.user?.email, anonId);

  if (!resolved) {
    return NextResponse.json({ error: "No identity available." }, { status: 400 });
  }

  const room = await getRoom(params.id);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const joined = await hasJoinedRoom(resolved.identity, params.id);
  if (!joined) {
    return NextResponse.json({ error: "Join the room before chatting." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { text } = (body ?? {}) as Record<string, unknown>;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }

  const profile = await getOrCreateProfile(resolved.identity, resolved.isAnonymous);
  const displayName = resolved.isAnonymous
    ? `Anonymous #${anonId}`
    : profile.displayName ?? session?.user?.name ?? "Waiting Room User";

  const result = await sendMessage(params.id, resolved.identity, displayName, text);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, retryAfterMs: result.retryAfterMs },
      { status: result.retryAfterMs !== undefined ? 429 : 503 },
    );
  }

  return NextResponse.json({ message: toPublicMessage(result.message), cooldownMs: result.cooldownMs });
}
