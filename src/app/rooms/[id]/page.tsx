import Link from "next/link";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import type { Metadata } from "next";
import { authOptions } from "@/lib/auth";
import { getJoinedAt, getRoom, getRoomAnalytics, hasJoinedRoom } from "@/lib/rooms";
import { getMoodBreakdown, getViewerMood } from "@/lib/roomMood";
import { getRoomEnergy } from "@/lib/roomEnergy";
import { getLastSeen } from "@/lib/roomPresence";
import RoomDetailScreen from "@/components/rooms/RoomDetailScreen";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const room = await getRoom(params.id);
  if (!room) return {};

  const title = `${room.name} — The Waiting Room`;
  const description = `${room.participantCount.toLocaleString()} people waiting. Join the wait for ${room.name}.`;
  // The room's own thumbnail doubles as the link's social preview.
  const imageUrl = `/api/og/room/${room.id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function RoomPage({ params }: { params: { id: string } }) {
  const room = await getRoom(params.id);
  const session = await getServerSession(authOptions);
  const anonId = headers().get("x-anon-id");
  const identity = session?.user?.email ?? (anonId ? `anon:${anonId}` : null);

  if (!room) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-white">
        <h1 className="font-satoshi text-[24px]">This room could not be found.</h1>
        <p className="max-w-[320px] font-inter text-[14px] text-white/70">
          It may have been removed, or the link is incorrect.
        </p>
        <Link
          href="/rooms"
          className="mt-2 font-figtree text-[12px] font-medium text-white underline underline-offset-4"
        >
          Back to Discover Rooms
        </Link>
      </div>
    );
  }

  const isOwner = identity === room.createdBy;
  const hasJoined = identity ? await hasJoinedRoom(identity, room.id) : false;
  const hasEnded = new Date(room.date).getTime() <= Date.now();
  const joinedAt = identity && hasJoined ? await getJoinedAt(identity, room.id) : null;

  const [{ breakdown }, viewerMood, roomEnergy, analytics, lastSeenAt] = await Promise.all([
    hasEnded ? Promise.resolve({ breakdown: [] }) : getMoodBreakdown(room.id),
    hasEnded || !identity ? Promise.resolve(null) : getViewerMood(room.id, identity),
    hasEnded ? Promise.resolve(0) : getRoomEnergy(room.id, room.participantCount),
    hasEnded ? getRoomAnalytics(room) : Promise.resolve(null),
    hasEnded || !identity || !hasJoined ? Promise.resolve(null) : getLastSeen(room.id, identity),
  ]);

  return (
    <RoomDetailScreen
      room={room}
      anonId={anonId}
      isOwner={isOwner}
      hasJoined={hasJoined}
      hasEnded={hasEnded}
      joinedAt={joinedAt}
      lastSeenAt={lastSeenAt}
      moodBreakdown={breakdown}
      viewerMood={viewerMood}
      roomEnergy={roomEnergy}
      analytics={analytics}
    />
  );
}
