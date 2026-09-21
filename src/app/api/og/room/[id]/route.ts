import { getRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

const DATA_URL_PATTERN = /^data:([^;]+);base64,([\s\S]+)$/;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const room = await getRoom(params.id);
  if (!room) {
    return new Response(null, { status: 404 });
  }

  const match = DATA_URL_PATTERN.exec(room.imageUrl);
  if (match) {
    const [, mime, base64] = match;
    return new Response(Buffer.from(base64, "base64"), {
      headers: { "Content-Type": mime, "Cache-Control": "public, max-age=3600" },
    });
  }

  // Not a data URL — the room image already lives at a real URL, so send
  // crawlers straight there instead of proxying the bytes ourselves.
  return Response.redirect(room.imageUrl, 302);
}
