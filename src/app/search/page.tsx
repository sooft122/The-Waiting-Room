import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getJoinedRoomIds, listRooms } from "@/lib/rooms";
import SearchScreen from "@/components/search/SearchScreen";

type SearchPageProps = {
  searchParams: { q?: string };
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const anonId = headers().get("x-anon-id");
  // listRooms doesn't depend on the session — fetch both at once instead of
  // waiting on the session before even starting the room list.
  const [session, rooms] = await Promise.all([getServerSession(authOptions), listRooms()]);
  const identity = session?.user?.email ?? (anonId ? `anon:${anonId}` : null);

  const joinedRoomIds = identity ? await getJoinedRoomIds(identity) : [];

  return (
    <SearchScreen
      rooms={rooms}
      anonId={anonId}
      initialQuery={searchParams.q}
      joinedRoomIds={joinedRoomIds}
    />
  );
}
