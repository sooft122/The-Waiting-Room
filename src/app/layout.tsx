import type { Metadata, Viewport } from "next";
import { Inter, Figtree } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import AuthProvider from "@/components/providers/AuthProvider";
import ProfileProvider from "@/components/providers/ProfileProvider";
import RoomModalProvider from "@/components/rooms/RoomModalProvider";
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0d10",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${figtree.variable}`}>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,701&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0c0d10] text-white antialiased">
        <AuthProvider>
          <ProfileProvider>
            <RoomModalProvider>{children}</RoomModalProvider>
          </ProfileProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
