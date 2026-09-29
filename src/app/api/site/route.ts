import { NextResponse } from "next/server";
import { getSiteState } from "@/lib/siteState";

export const dynamic = "force-dynamic";

/**
 * Checked every few seconds by every open page (SiteStateProvider) to pick up
 * admin changes — room creation being locked, rooms edited or removed,
 * accounts changed. The answer is the same for everyone, so the CDN keeps it
 * for a couple of seconds: however many pages are open, Redis is asked at
 * most about once per couple of seconds per region.
 */
export async function GET() {
  const state = await getSiteState();
  return NextResponse.json(state, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=2" },
  });
}
