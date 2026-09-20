import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getJoinedRoomIds, getRoomsByIds } from "@/lib/rooms";
import ArchiveRoomScreen from "@/components/archive/ArchiveRoomScreen";

export default async function ArchivePage() {
  const session = await getServerSession(authOptions);
  const anonId = headers().get("x-anon-id");
  const identity = session?.user?.email ?? (anonId ? `anon:${anonId}` : null);

  const joinedIds = identity ? await getJoinedRoomIds(identity) : [];
  const rooms = await getRoomsByIds(joinedIds);

  return <ArchiveRoomScreen rooms={rooms} anonId={anonId} />;
}
