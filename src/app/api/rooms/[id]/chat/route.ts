import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { waitUntil } from "@vercel/functions";
import { authOptions } from "@/lib/auth";
import { getRoom, hasJoinedRoom } from "@/lib/rooms";
import { getOrCreateProfile } from "@/lib/profile";
import { getCooldownRemainingMs, getMessages, sendMessage, toPublicMessage } from "@/lib/roomChat";
import { ROOM_VIEWING_HEADER } from "@/lib/chatNotifications";
import { markViewingRoom } from "@/lib/roomPush";
import { notifyRoomChat } from "@/lib/roomChatNotifier";

export const dynamic = "force-dynamic";

function resolveIdentity(sessionEmail: string | null | undefined, anonId: string | null) {
  if (sessionEmail) return { identity: sessionEmail, isAnonymous: false as const };
  if (anonId) return { identity: `anon:${anonId}`, isAnonymous: true as const };
  return null;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const anonId = headers().get("x-anon-id");
  const resolved = resolveIdentity(session?.user?.email, anonId);
  // A joined viewer's visible room page says so every so often, so
  // new-message alerts skip people who are looking at the room right now.
  const viewing = request.headers.get(ROOM_VIEWING_HEADER) === "1";

  const [messages, cooldownRemainingMs] = await Promise.all([
    getMessages(params.id),
    resolved ? getCooldownRemainingMs(params.id, resolved.identity) : Promise.resolve(0),
    resolved && viewing ? markViewingRoom(params.id, resolved.identity) : null,
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

  // Alerts go out to everyone else who turned notifications on, without
  // holding up the sender — waitUntil keeps the function alive on Vercel
  // until they're sent.
  waitUntil(notifyRoomChat(room, result.message));

  return NextResponse.json({ message: toPublicMessage(result.message), cooldownMs: result.cooldownMs });
}
