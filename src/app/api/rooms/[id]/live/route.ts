import { NextResponse } from "next/server";
import { getRoom, isRoomActive } from "@/lib/rooms";
import { getMoodBreakdown } from "@/lib/roomMood";
import { getRoomEnergy } from "@/lib/roomEnergy";
import { getGlowingSeeds } from "@/lib/roomPresence";

/**
 * Polled periodically by everyone currently viewing a room so another
 * person joining, voting a mood, or checking in shows up without a manual
 * reload — the room page itself only ever re-fetches its own server data
 * for the CURRENT viewer's own actions (join/leave), not for what anyone
 * else does. No auth/identity needed: everything returned here is already
 * shown to any viewer of the room regardless of whether they've joined.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const room = await getRoom(params.id);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const active = isRoomActive(room);
  const [{ breakdown }, roomEnergy, glowingDots] = await Promise.all([
    active ? getMoodBreakdown(room.id) : Promise.resolve({ breakdown: [] }),
    active ? getRoomEnergy(room.id, room.participantCount) : Promise.resolve(0),
    active ? getGlowingSeeds(room.id) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    participantCount: room.participantCount,
    moodBreakdown: breakdown,
    roomEnergy,
    glowingDots,
  });
}
