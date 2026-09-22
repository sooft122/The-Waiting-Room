import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getJoinedRoomIds, listRooms } from "@/lib/rooms";
import { getRoomSection, getSectionRooms } from "@/lib/roomSections";
import RoomSectionAllScreen from "@/components/rooms/RoomSectionAllScreen";

type RoomSectionAllPageProps = {
  params: { slug: string };
};

export default async function RoomSectionAllPage({ params }: RoomSectionAllPageProps) {
  const section = getRoomSection(params.slug);
  if (!section) notFound();

  const session = await getServerSession(authOptions);
  const anonId = headers().get("x-anon-id");
  const identity = session?.user?.email ?? (anonId ? `anon:${anonId}` : null);

  const allRooms = await listRooms();
  const rooms = getSectionRooms(allRooms, section.slug);
  const joinedRoomIds = identity ? await getJoinedRoomIds(identity) : [];

  return (
    <RoomSectionAllScreen
      title={section.title}
      rooms={rooms}
      emptyMessage={section.emptyMessage}
      anonId={anonId}
      joinedRoomIds={joinedRoomIds}
    />
  );
}
