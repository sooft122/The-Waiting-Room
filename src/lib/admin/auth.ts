import { timingSafeEqual } from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ALL_PERMISSIONS, type AdminAccess } from "./permissions";
import { getMember, normalizeEmail } from "./team";

export type AdminUser = AdminAccess & { email: string; name: string; image: string | null };

// The dashboard's owner, and the secret part of its link, live in environment
// variables (set in Vercel) rather than in the code:
//   ADMIN_EMAILS         the owner's Google account (comma-separated, should
//                        there ever be more than one): full access, and the
//                        only one who can add, change or remove other admins
//   ADMIN_DASHBOARD_KEY  the random string in the dashboard's URL
// The owner adds everyone else from the dashboard itself, each with just the
// permissions picked for them (team.ts, permissions.ts). Opening it takes
// both: the link, and being signed in as the owner or one of those admins.

export function getOwnerEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && getOwnerEmails().includes(normalizeEmail(email));
}

/** What this account can do on the dashboard, or null if it isn't an admin.
 * If storage can't be reached, only the owner gets in. */
export async function getAdminAccess(email: string | null | undefined): Promise<AdminAccess | null> {
  if (!email) return null;
  if (isOwnerEmail(email)) return { role: "owner", permissions: [...ALL_PERMISSIONS] };
  const member = await getMember(email).catch(() => null);
  return member ? { role: "admin", permissions: member.permissions } : null;
}

/** Constant-time comparison against the dashboard's secret link key. */
export function isAdminKey(key: unknown): boolean {
  const expected = process.env.ADMIN_DASHBOARD_KEY;
  if (!expected || expected.length < 16 || typeof key !== "string") return false;
  const given = Buffer.from(key);
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** The signed-in admin, with what they're allowed to do — read fresh on
 * every request, so removing someone or changing their access takes effect
 * straight away. */
export async function getSessionAdmin(): Promise<AdminUser | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  const access = await getAdminAccess(email);
  if (!email || !access) return null;
  return { ...access, email, name: session.user?.name ?? email, image: session.user?.image ?? null };
}

/** The admin behind an API request — which must also carry the link's key,
 * so a script injected into some other page of the site couldn't drive the
 * API with the admin's cookies even if one ever ran there. */
export async function getRequestAdmin(request: Request): Promise<AdminUser | null> {
  if (!isAdminKey(request.headers.get("x-admin-key"))) return null;
  return getSessionAdmin();
}
