import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getJoinedRoomIds, getRoomsByIds, listRooms } from "@/lib/rooms";
import DiscoverRoomsScreen from "@/components/rooms/DiscoverRoomsScreen";

export default async function RoomsPage() {
  const anonId = headers().get("x-anon-id");
  // listRooms doesn't depend on the session — fetch both at once instead of
  // waiting on the session before even starting the room list.
  const [session, rooms] = await Promise.all([getServerSession(authOptions), listRooms()]);
  const identity = session?.user?.email ?? (anonId ? `anon:${anonId}` : null);

  const joinedRoomIds = identity ? await getJoinedRoomIds(identity) : [];

  // The viewer's own private rooms, for "Rooms I Created" only — listRooms
  // leaves private rooms out. Creators can't leave their own rooms, so these
  // are always among the joined ids the public list doesn't already cover.
  const publicIds = new Set(rooms.map((room) => room.id));
  const ownPrivateRooms = identity
    ? (await getRoomsByIds(joinedRoomIds.filter((id) => !publicIds.has(id)))).filter(
        (room) => room.isPrivate && room.createdBy === identity,
      )
    : [];

  return (
    <DiscoverRoomsScreen
      rooms={rooms}
      ownPrivateRooms={ownPrivateRooms}
      anonId={anonId}
      joinedRoomIds={joinedRoomIds}
    />
  );
}
