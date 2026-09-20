import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getRoom, leaveRoom } from "@/lib/rooms";

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

  if (room.createdBy === identity) {
    return NextResponse.json(
      { error: "You can't stop waiting on a room you created." },
      { status: 403 },
    );
  }

  try {
    await leaveRoom(identity, params.id);
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
