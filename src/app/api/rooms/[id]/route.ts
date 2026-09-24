import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { deleteRoom, getRoom, getRoomEndTime, isRoomCategory, parseRoomTime, updateRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

const MAX_IMAGE_DATA_URL_LENGTH = 5_600_000;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in with Google to edit a room." }, { status: 401 });
  }

  const room = await getRoom(params.id);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (room.createdBy !== session.user.email) {
    return NextResponse.json({ error: "Only the room's creator can edit it." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { name, date, time: rawTime, category, imageUrl } = (body ?? {}) as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Room name is required." }, { status: 400 });
  }
  if (name.trim().length > 100) {
    return NextResponse.json(
      { error: "Room name must be 100 characters or fewer." },
      { status: 400 },
    );
  }
  if (typeof date !== "string" || Number.isNaN(Date.parse(date))) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }
  const parsedTime = parseRoomTime(rawTime);
  if (!parsedTime.ok) {
    return NextResponse.json({ error: "Invalid time — expected HH:mm." }, { status: 400 });
  }
  const time = parsedTime.time;
  if (getRoomEndTime({ date, time }).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "The date must be in the future — pick when the wait ends." },
      { status: 400 },
    );
  }
  if (!isRoomCategory(category)) {
    return NextResponse.json({ error: "A valid category is required." }, { status: 400 });
  }
  if (typeof imageUrl !== "string" || !imageUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "A thumbnail image is required." }, { status: 400 });
  }
  if (imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    return NextResponse.json(
      { error: "Image is too large — please use a file under 4MB." },
      { status: 400 },
    );
  }

  const updated = await updateRoom(params.id, {
    name: name.trim(),
    date,
    time,
    category,
    imageUrl,
  });

  return NextResponse.json({ room: updated });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in with Google to delete a room." }, { status: 401 });
  }

  const room = await getRoom(params.id);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (room.createdBy !== session.user.email) {
    return NextResponse.json({ error: "Only the room's creator can delete it." }, { status: 403 });
  }

  await deleteRoom(params.id);
  return NextResponse.json({ ok: true });
}
