import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { isAdminEmail, isAdminKey } from "@/lib/admin/auth";
import AdminApp from "@/components/admin/AdminApp";
import AdminGate from "@/components/admin/AdminGate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin — The Waiting Room",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  // The link itself is the secret — never pass it along to other sites.
  referrer: "no-referrer",
};

/**
 * The admin dashboard, at /admin/<ADMIN_DASHBOARD_KEY>. The wrong key is an
 * ordinary 404, so the page gives nothing away; the right key still needs a
 * Google sign-in with an account listed in ADMIN_EMAILS.
 */
export default async function AdminPage({ params }: { params: { key: string } }) {
  if (!isAdminKey(params.key)) notFound();

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return <AdminGate state="signed-out" />;
  if (!isAdminEmail(email)) return <AdminGate state="not-admin" email={email} />;

  return (
    <AdminApp
      adminKey={params.key}
      admin={{ email, name: session.user?.name ?? email, image: session.user?.image ?? null }}
    />
  );
}
