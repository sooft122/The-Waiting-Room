import { NextResponse } from "next/server";
import { getRequestAdmin } from "@/lib/admin/auth";
import { AdminError } from "@/lib/admin/errors";
import { runAdminOp } from "@/lib/admin/ops";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** The admin dashboard's single endpoint: POST { op, args }. Anyone who isn't
 * a signed-in admin carrying the dashboard's key gets the same plain 404 as
 * any page that doesn't exist. */
export async function POST(request: Request) {
  const admin = await getRequestAdmin(request);
  if (!admin) return new NextResponse("Not Found", { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { op, args } = (body ?? {}) as { op?: unknown; args?: unknown };
  if (typeof op !== "string") {
    return NextResponse.json({ error: "Missing request type." }, { status: 400 });
  }

  try {
    const result = await runAdminOp(
      admin,
      op,
      args && typeof args === "object" ? (args as Record<string, unknown>) : {},
    );
    return NextResponse.json(result ?? null, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(`admin op "${op}" failed`, error);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
}
