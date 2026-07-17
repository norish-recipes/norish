"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useOfflineWeb } from "@/context/offline-web-context";

import { swLogger as log } from "@norish/shared/lib/logger";

function collectRuntimeAssets(): string[] {
  const values = new Set<string>();
  const elements = document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
    'script[src], link[rel="stylesheet"][href], link[rel="preload"][as="script"][href], link[rel="preload"][as="style"][href]'
  );

  for (const element of elements) {
    const value = element instanceof HTMLScriptElement ? element.src : element.href;

    if (!value) continue;

    const url = new URL(value, window.location.origin);

    if (url.origin === window.location.origin && url.pathname.startsWith("/_next/static/")) {
      values.add(url.href);
    }
  }

  return [...values];
}

export default function RegisterServiceWorker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeScope, phase, renderIdentityOnly } = useOfflineWeb();
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const search = searchParams.toString();
  const route = useMemo(() => `${pathname}${search ? `?${search}` : ""}`, [pathname, search]);

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
    if (!registration || !activeScope || renderIdentityOnly || phase !== "live") return;

    const worker = navigator.serviceWorker.controller ?? registration.active;

    if (!worker) return;

    worker.postMessage({
      type: "CONFIRM_ROUTE_SHELL",
      route,
      assets: collectRuntimeAssets(),
    });
  }, [activeScope, phase, registration, renderIdentityOnly, route]);

  return null;
}

export { collectRuntimeAssets };
