import { getSessionAdmin } from "@/lib/admin/auth";
import { getRoomImage } from "@/lib/admin/rooms";
import { getProfilePhoto } from "@/lib/admin/people";

export const dynamic = "force-dynamic";

const DATA_URL_PATTERN = /^data:([^;,]+);base64,([\s\S]+)$/;

/** Room thumbnails (including trashed and private rooms) and uploaded
 * profile photos for the dashboard. They're stored inline as data URLs, so
 * they're decoded here instead of being shipped inside every list. The
 * `v` in the URL changes whenever the image does, so it's cached for good. */
export async function GET(request: Request) {
  if (!(await getSessionAdmin())) return new Response("Not Found", { status: 404 });

  const params = new URL(request.url).searchParams;
  const roomId = params.get("room");
  const person = params.get("person");
  const image = roomId ? await getRoomImage(roomId) : person ? await getProfilePhoto(person) : null;
  if (!image) return new Response("Not Found", { status: 404 });

  const match = DATA_URL_PATTERN.exec(image);
  if (!match) {
    return image.startsWith("https://") ? Response.redirect(image, 302) : new Response(null, { status: 404 });
  }
  const [, mime, base64] = match;
  return new Response(Buffer.from(base64, "base64"), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
