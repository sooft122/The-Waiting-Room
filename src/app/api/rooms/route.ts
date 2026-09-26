import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  createRoom,
  getRoom,
  getRoomEndTime,
  isRoomCategory,
  joinRoom,
  listRooms,
  parseRoomTime,
} from "@/lib/rooms";
import { isCountryCode, setParticipantCountry } from "@/lib/roomCountry";
import { parseDescriptionFields } from "@/lib/roomDescriptionFields";

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

  const fields = (body ?? {}) as Record<string, unknown>;
  const { name, date, time: rawTime, category, imageUrl } = fields;

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

  const descriptionFields = parseDescriptionFields(fields);
  if (!descriptionFields.ok) {
    return NextResponse.json({ error: descriptionFields.error }, { status: 400 });
  }

  try {
    const countryCode = headers().get("x-vercel-ip-country");
    const room = await createRoom({
      name: name.trim(),
      date,
      time,
      category,
      imageUrl,
      createdBy: session.user.email,
      createdByLabel: session.user.name ?? session.user.email,
      createdByCountry: isCountryCode(countryCode) ? countryCode : null,
      ...descriptionFields.fields,
    });

    // The creator is automatically a participant of their own room — also
    // recorded in the live country breakdown, alongside the permanent
    // createdByCountry field above, so they show up on the map/list like
    // anyone else currently waiting.
    await Promise.all([
      joinRoom(session.user.email, room.id),
      isCountryCode(countryCode)
        ? setParticipantCountry(room.id, session.user.email, countryCode)
        : null,
    ]);
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
