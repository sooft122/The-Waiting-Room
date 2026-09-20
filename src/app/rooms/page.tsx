import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getJoinedRoomIds, listRooms } from "@/lib/rooms";
import DiscoverRoomsScreen from "@/components/rooms/DiscoverRoomsScreen";

export default async function RoomsPage() {
  const session = await getServerSession(authOptions);
  const anonId = headers().get("x-anon-id");
  const identity = session?.user?.email ?? (anonId ? `anon:${anonId}` : null);

  const rooms = await listRooms();
  const joinedRoomIds = identity ? await getJoinedRoomIds(identity) : [];

  return <DiscoverRoomsScreen rooms={rooms} anonId={anonId} joinedRoomIds={joinedRoomIds} />;
}
