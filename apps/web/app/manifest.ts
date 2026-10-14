import type { MetadataRoute } from "next";

import { siteConfig } from "@norish/web/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#F8F3E7",
    screenshots: [
      {
        src: "/mockup-norish.png",
        sizes: "1280x720",
        type: "image/png",
        label: "Norish app desktop and mobile",
        form_factor: "wide",
      },
    ],
    // The PNGs are listed twice: "any" for launchers that show the icon as is,
    // "maskable" for Android to crop to its own shape (#611).
    icons: [
      { src: "/brand/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
