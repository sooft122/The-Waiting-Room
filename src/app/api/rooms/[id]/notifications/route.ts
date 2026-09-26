import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getRoom, hasJoinedRoom, isRoomActive } from "@/lib/rooms";
import { getPushConfig } from "@/lib/pushConfig";
import { isPushEndpoint, parsePushSubscription } from "@/lib/pushSubscription";
import {
  disableRoomAlerts,
  enableRoomAlerts,
  getRoomAlertsEnabled,
  isSubscriptionId,
  subscriptionIdFor,
} from "@/lib/roomPush";

export const dynamic = "force-dynamic";

const STORAGE_ERROR =
  "Room storage isn't configured yet — Upstash Redis credentials are missing on the server.";

async function resolveIdentity(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const anonId = headers().get("x-anon-id");
  return session?.user?.email ?? (anonId ? `anon:${anonId}` : null);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Whether this browser has new-message alerts on for this room. It's
 * identified by ?sub=, the hash of its push subscription (never the
 * subscription itself, which doubles as a delivery address). */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const identity = await resolveIdentity();
  const subscriptionId = new URL(request.url).searchParams.get("sub");

  const enabled =
    identity && isSubscriptionId(subscriptionId)
      ? await getRoomAlertsEnabled(params.id, subscriptionId, identity)
      : false;

  return NextResponse.json({ enabled }, { headers: { "Cache-Control": "no-store" } });
}

/** Turns alerts on — body: { subscription } from PushSubscription.toJSON(). */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  if (!getPushConfig()) {
    return NextResponse.json(
      { error: "Notifications aren't set up on this server yet." },
      { status: 503 },
    );
  }

  const identity = await resolveIdentity();
  if (!identity) {
    return NextResponse.json({ error: "No identity available." }, { status: 400 });
  }

  const room = await getRoom(params.id);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (!isRoomActive(room)) {
    return NextResponse.json({ error: "This room has already ended." }, { status: 400 });
  }
  if (!(await hasJoinedRoom(identity, room.id))) {
    return NextResponse.json({ error: "Join the room to get notifications." }, { status: 403 });
  }

  const subscription = parsePushSubscription((await readBody(request)).subscription);
  if (!subscription) {
    return NextResponse.json(
      { error: "This browser's notification service isn't supported." },
      { status: 400 },
    );
  }

  try {
    await enableRoomAlerts(room.id, identity, subscription);
  } catch {
    return NextResponse.json({ error: STORAGE_ERROR }, { status: 503 });
  }
  return NextResponse.json({ enabled: true });
}

/** Turns alerts off — body: { endpoint }. Knowing the endpoint is proof
 * enough that it's this browser asking, so no identity check. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { endpoint } = await readBody(request);
  if (!isPushEndpoint(endpoint)) {
    return NextResponse.json({ error: "Missing subscription." }, { status: 400 });
  }

  try {
    await disableRoomAlerts(params.id, subscriptionIdFor(endpoint));
  } catch {
    return NextResponse.json({ error: STORAGE_ERROR }, { status: 503 });
  }
  return NextResponse.json({ enabled: false });
}
