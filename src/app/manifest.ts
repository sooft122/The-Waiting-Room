import type { MetadataRoute } from "next";

// Lets people add the site to their Home Screen as an app — which, on iPhone
// and iPad, is what makes new-message notifications possible at all.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Waiting Room",
    short_name: "Waiting Room",
    description: "Something worth waiting for. Join people around the world waiting for the same moment.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0d10",
    theme_color: "#0c0d10",
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/app-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
