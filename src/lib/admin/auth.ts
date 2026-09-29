import { timingSafeEqual } from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export type AdminUser = { email: string; name: string; image: string | null };

// Who can use the dashboard, and the secret part of its link, both live in
// environment variables (set in Vercel) rather than in the code:
//   ADMIN_EMAILS         comma-separated Google accounts with access
//   ADMIN_DASHBOARD_KEY  the random string in the dashboard's URL
// Opening it takes both: the link, and being signed in as one of those accounts.

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && getAdminEmails().includes(email.toLowerCase());
}

/** Constant-time comparison against the dashboard's secret link key. */
export function isAdminKey(key: unknown): boolean {
  const expected = process.env.ADMIN_DASHBOARD_KEY;
  if (!expected || expected.length < 16 || typeof key !== "string") return false;
  const given = Buffer.from(key);
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export async function getSessionAdmin(): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email || !isAdminEmail(email)) return null;
  return { email, name: session.user?.name ?? email, image: session.user?.image ?? null };
}

/** The admin behind an API request — which must also carry the link's key,
 * so a script injected into some other page of the site couldn't drive the
 * API with the admin's cookies even if one ever ran there. */
export async function getRequestAdmin(request: Request): Promise<AdminUser | null> {
  if (!isAdminKey(request.headers.get("x-admin-key"))) return null;
  return getSessionAdmin();
}
