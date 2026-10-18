import type { MetadataRoute } from "next";

import { addBasePath, APP_ROOT } from "@norish/shared/lib/base-path";
import { siteConfig } from "@norish/web/config/site";

const SCREENSHOTS = [
  { name: "dashboard", label: "Recipe library" },
  { name: "recipe", label: "A recipe" },
  { name: "groceries", label: "Groceries" },
  { name: "calendar", label: "Meal calendar" },
];

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: APP_ROOT,
    scope: APP_ROOT,
    display: "standalone",
    background_color: "#F8F3E7",
    // Shown by the richer install sheet: "wide" on desktop, "narrow" on phones.
    // Each form factor keeps one aspect ratio, or Chrome drops the set.
    screenshots: [
      ...SCREENSHOTS.map(({ name, label }) => ({
        src: addBasePath(`/brand/screenshots/${name}-wide.jpg`),
        sizes: "1200x900",
        type: "image/jpeg",
        form_factor: "wide" as const,
        label,
      })),
      ...SCREENSHOTS.map(({ name, label }) => ({
        src: addBasePath(`/brand/screenshots/${name}-narrow.jpg`),
        sizes: "780x1546",
        type: "image/jpeg",
        form_factor: "narrow" as const,
        label,
      })),
    ],
    // The PNGs are listed twice: "any" for launchers that show the icon as is,
    // "maskable" for Android to crop to its own shape (#611).
    icons: [
      { src: addBasePath("/brand/favicon.svg"), sizes: "any", type: "image/svg+xml" },
      {
        src: addBasePath("/brand/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: addBasePath("/brand/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: addBasePath("/brand/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: addBasePath("/brand/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
