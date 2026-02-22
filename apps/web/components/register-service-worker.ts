"use client";

import { useEffect } from "react";

import { swLogger as log } from "@norish/shared/lib/logger";

export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => log.error({ err }, "Service worker registration failed"));
    } else {
      log.warn("Service workers not supported in this browser.");
    }
  }, []);

  return null;
}
