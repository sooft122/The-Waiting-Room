import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getJoinedRoomIds, getRoomsByIds } from "@/lib/rooms";
import ProfileScreen from "@/components/profile/ProfileScreen";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const anonId = headers().get("x-anon-id");
  const identity = session?.user?.email ?? (anonId ? `anon:${anonId}` : null);

  const joinedIds = identity ? await getJoinedRoomIds(identity) : [];
  const rooms = await getRoomsByIds(joinedIds);

  return <ProfileScreen rooms={rooms} anonId={anonId} />;
}
