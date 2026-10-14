import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sambhal: report it, we deal with it",
    short_name: "Sambhal",
    description: "Report community problems. Neighbours confirm, someone takes it on, and everyone verifies the fix.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#238472",
    lang: "en-IN",
    categories: ["social", "utilities", "lifestyle"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Report a problem", short_name: "Report", url: "/report", icons: [{ src: "/icons/192", sizes: "192x192" }] },
      { name: "Map", url: "/map", icons: [{ src: "/icons/192", sizes: "192x192" }] },
    ],
  };
}
