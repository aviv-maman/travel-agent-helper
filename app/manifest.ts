import type { MetadataRoute } from "next";

/**
 * PWA web app manifest (served at /manifest.webmanifest, auto-linked by Next).
 * Makes the app installable on the home screen and launch full-screen. The app
 * is Hebrew-first and dark by default, so the splash + theme colours are dark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "כלי עזר לסוכני נסיעות",
    short_name: "סוכני נסיעות",
    description: "חיפוש ספקים, דמי ביטול, הסעות, כבודה ומלונות",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: "he",
    dir: "rtl",
    categories: ["travel", "business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
