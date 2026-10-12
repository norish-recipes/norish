import type { MetadataRoute } from "next";

import { siteConfig } from "@norish/web/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#FFFEF7",
    screenshots: [
      {
        src: "/mockup-norish.png",
        sizes: "1280x720",
        type: "image/png",
        label: "Norish app desktop and mobile",
        form_factor: "wide",
      },
    ],
    // No SVG here: Firefox for Android tries a "sizes: any" icon before every PNG,
    // and iOS picks no icon at all once the manifest lists one (WebKit bug 256429),
    // so either installs Norish with a default icon (#611).
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/favicon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
