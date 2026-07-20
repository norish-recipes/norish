"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useOfflineWeb } from "@/context/offline-web-context";

import { swLogger as log } from "@norish/shared/lib/logger";

const OFFLINE_SHELL_ROUTES = new Set(["/", "/calendar", "/groceries"]);

function isOfflineShellRoute(pathname: string): boolean {
  return OFFLINE_SHELL_ROUTES.has(pathname);
}

export default function RegisterServiceWorker() {
  const pathname = usePathname();
  const { activeScope, phase, renderIdentityOnly } = useOfflineWeb();
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      log.warn("Service workers not supported in this browser.");

      return;
    }

    let cancelled = false;

    void navigator.serviceWorker
      .register("/sw.js")
      .then((next) => {
        if (!cancelled) setRegistration(next);
      })
      .catch((err) => log.error({ err }, "Service worker registration failed"));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !registration ||
      !activeScope ||
      renderIdentityOnly ||
      phase !== "live" ||
      !isOfflineShellRoute(pathname)
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      let worker = navigator.serviceWorker.controller ?? registration.active;

      if (!worker) {
        try {
          const readyRegistration = await navigator.serviceWorker.ready;

          if (cancelled) return;
          worker = navigator.serviceWorker.controller ?? readyRegistration.active;
        } catch (err) {
          log.error({ err }, "Service worker did not become ready");

          return;
        }
      }

      worker?.postMessage({
        type: "CONFIRM_ROUTE_SHELL",
        route: pathname,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [activeScope, pathname, phase, registration, renderIdentityOnly]);

  return null;
}

export { isOfflineShellRoute };
