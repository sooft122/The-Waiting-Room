import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createRoom, getRoom, isRoomCategory, joinRoom, listRooms } from "@/lib/rooms";

// Base64 inflates raw bytes by ~4/3; this caps the *encoded* string length,
// corresponding to roughly a 4MB source image.
const MAX_IMAGE_DATA_URL_LENGTH = 5_600_000;

export async function GET() {
  const rooms = await listRooms();
  return NextResponse.json({ rooms });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Sign in with Google to create a room." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, date, category, imageUrl } = (body ?? {}) as Record<string, unknown>;

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
  if (new Date(date).getTime() <= Date.now()) {
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

  try {
    const room = await createRoom({
      name: name.trim(),
      date,
      category,
      imageUrl,
      createdBy: session.user.email,
      createdByLabel: session.user.name ?? session.user.email,
    });

    // The creator is automatically a participant of their own room.
    await joinRoom(session.user.email, room.id);
    const roomWithCreatorJoined = (await getRoom(room.id)) ?? room;

    return NextResponse.json({ room: roomWithCreatorJoined }, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        error:
          "Room storage isn't configured yet — Upstash Redis credentials are missing on the server.",
      },
      { status: 503 },
    );
  }
}
