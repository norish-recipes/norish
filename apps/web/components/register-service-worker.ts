"use client";

import { useEffect } from "react";

import { swLogger as log } from "@norish/shared/lib/logger";

// @serwist/turbopack serves the worker from a Route Handler, not public/.
const SW_URL = "/serwist/sw.js";

export default function RegisterServiceWorker() {
  useEffect(() => {
    // Parity with the `disable: NODE_ENV === "development"` option the
    // @serwist/next plugin used to carry. The Route Handler does build the
    // worker in dev, but registering it would put a precache manifest of
    // dev-server assets in front of the app.
    if (process.env.NODE_ENV === "development") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        // `scope` is explicit and load-bearing: the script now lives under
        // /serwist/, so the default scope would be /serwist/ and the worker
        // would control nothing. The handler sends Service-Worker-Allowed: /
        // to permit the widening. `type: "module"` matches esbuild's ESM
        // output — a classic-script registration would fail to parse it.
        .register(SW_URL, { scope: "/", type: "module" })
        .catch((err) => log.error({ err }, "Service worker registration failed"));
    } else {
      log.warn("Service workers not supported in this browser.");
    }
  }, []);

  return null;
}
