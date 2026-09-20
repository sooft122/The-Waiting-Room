import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getRoom, joinRoom } from "@/lib/rooms";
import { checkIn } from "@/lib/roomPresence";

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

  try {
    // A freshly-joined participant counts as present immediately, without
    // needing to hit "I'm Still Here" first. These two writes are independent.
    await Promise.all([joinRoom(identity, params.id), checkIn(params.id, identity)]);
  } catch {
    return NextResponse.json(
      {
        error:
          "Room storage isn't configured yet — Upstash Redis credentials are missing on the server.",
      },
      { status: 503 },
    );
  }

  const updatedRoom = await getRoom(params.id);
  return NextResponse.json({ room: updatedRoom });
}
