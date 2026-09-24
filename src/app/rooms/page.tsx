import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getJoinedRoomIds, listRooms } from "@/lib/rooms";
import DiscoverRoomsScreen from "@/components/rooms/DiscoverRoomsScreen";

export default async function RoomsPage() {
  const anonId = headers().get("x-anon-id");
  // listRooms doesn't depend on the session — fetch both at once instead of
  // waiting on the session before even starting the room list.
  const [session, rooms] = await Promise.all([getServerSession(authOptions), listRooms()]);
  const identity = session?.user?.email ?? (anonId ? `anon:${anonId}` : null);

  const joinedRoomIds = identity ? await getJoinedRoomIds(identity) : [];

  return <DiscoverRoomsScreen rooms={rooms} anonId={anonId} joinedRoomIds={joinedRoomIds} />;
}
