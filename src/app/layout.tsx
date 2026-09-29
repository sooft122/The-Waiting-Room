import type { Metadata, Viewport } from "next";
import { Inter, Figtree } from "next/font/google";
import { unstable_noStore as noStore } from "next/cache";
import AuthProvider from "@/components/providers/AuthProvider";
import ProfileProvider from "@/components/providers/ProfileProvider";
import SiteStateProvider from "@/components/providers/SiteStateProvider";
import SuspendedNotice from "@/components/providers/SuspendedNotice";
import RoomModalProvider from "@/components/rooms/RoomModalProvider";
import { getSiteState } from "@/lib/siteState";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const SITE_DESCRIPTION =
  "Something worth waiting for. Join people around the world waiting for the same moment.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  title: "The Waiting Room",
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "The Waiting Room",
    description: SITE_DESCRIPTION,
    siteName: "The Waiting Room",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Waiting Room",
    description: SITE_DESCRIPTION,
  },
  // Opened from the Home Screen, the site runs full-screen like an app, under
  // a short name instead of whichever page's full title it was saved from.
  appleWebApp: {
    capable: true,
    title: "Waiting Room",
    statusBarStyle: "black",
  },
  // The standard twin of Apple's tag above — Chrome warns without it.
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0d10",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Every page is rendered per request anyway (they all read the visitor's
  // cookie); this says so explicitly, so the admin-controlled state below is
  // always current rather than baked in at build time.
  noStore();
  const siteState = await getSiteState();

  return (
    <html lang="en" className={`${inter.variable} ${figtree.variable}`}>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,501,700,701&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0c0d10] text-white antialiased">
        <AuthProvider>
          <ProfileProvider>
            <SiteStateProvider initial={siteState}>
              <RoomModalProvider>{children}</RoomModalProvider>
              <SuspendedNotice />
            </SiteStateProvider>
          </ProfileProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
