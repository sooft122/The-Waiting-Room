import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getJoinedAt, getJoinedRoomIds, getRoomEndTime, getRoomsByIds } from "@/lib/rooms";
import ProfileScreen from "@/components/profile/ProfileScreen";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const anonId = headers().get("x-anon-id");
  const identity = session?.user?.email ?? (anonId ? `anon:${anonId}` : null);

  const joinedIds = identity ? await getJoinedRoomIds(identity) : [];
  const rooms = await getRoomsByIds(joinedIds);

  // When this viewer joined each room and when that room's wait ends — the
  // inputs to "Total Wait Time", which the screen keeps ticking live.
  const joinedAts = identity
    ? await Promise.all(rooms.map((room) => getJoinedAt(identity, room.id)))
    : [];
  const waits = rooms.flatMap((room, i) => {
    const joinedAt = joinedAts[i];
    return joinedAt ? [{ joinedAt, endsAt: getRoomEndTime(room).toISOString() }] : [];
  });

  return <ProfileScreen rooms={rooms} anonId={anonId} waits={waits} renderedAt={Date.now()} />;
}
