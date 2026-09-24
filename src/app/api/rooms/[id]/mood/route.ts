import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getRoom, hasJoinedRoom } from "@/lib/rooms";
import { castMoodVote, getMoodBreakdown, isMood } from "@/lib/roomMood";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const anonId = headers().get("x-anon-id");
  // None of these three depend on each other — fetched together instead of
  // one after another so a mood vote isn't paying for three round trips
  // back to back before it even starts validating anything.
  const [session, room, body] = await Promise.all([
    getServerSession(authOptions),
    getRoom(params.id),
    request.json().catch(() => null),
  ]);
  const identity = session?.user?.email ?? (anonId ? `anon:${anonId}` : null);

  if (!identity) {
    return NextResponse.json({ error: "No identity available." }, { status: 400 });
  }
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  const { mood } = (body ?? {}) as Record<string, unknown>;
  if (!isMood(mood)) {
    return NextResponse.json({ error: "Invalid mood." }, { status: 400 });
  }

  const joined = await hasJoinedRoom(identity, params.id);
  if (!joined) {
    return NextResponse.json(
      { error: "Join the room before setting your mood." },
      { status: 403 },
    );
  }

  await castMoodVote(params.id, identity, mood);
  const { breakdown } = await getMoodBreakdown(params.id);

  return NextResponse.json({ mood, breakdown });
}
