import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getRoom, hasJoinedRoom } from "@/lib/rooms";
import { CHECK_IN_COOLDOWN_MS, checkIn, getLastSeen } from "@/lib/roomPresence";

/** "I'm Still Here" — a live check-in used for the Lobby and Room Energy.
 * Limited to once per hour per identity, enforced server-side so it can't
 * be spammed to inflate Room Energy. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const anonId = headers().get("x-anon-id");
  const identity = session?.user?.email ?? (anonId ? `anon:${anonId}` : null);

  if (!identity) {
    return NextResponse.json({ error: "No identity available." }, { status: 400 });
  }

  const room = await getRoom(params.id);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const joined = await hasJoinedRoom(identity, params.id);
  if (!joined) {
    return NextResponse.json({ error: "Join the room to check in." }, { status: 403 });
  }

  const previousLastSeen = await getLastSeen(params.id, identity);
  if (previousLastSeen) {
    const elapsedMs = Date.now() - new Date(previousLastSeen).getTime();
    if (elapsedMs < CHECK_IN_COOLDOWN_MS) {
      return NextResponse.json(
        {
          error: "You can check in again in a bit.",
          lastSeenAt: previousLastSeen,
          cooldownActive: true,
        },
        { status: 429 },
      );
    }
  }

  const lastSeenAt = await checkIn(params.id, identity);
  return NextResponse.json({ lastSeenAt, cooldownActive: false });
}
