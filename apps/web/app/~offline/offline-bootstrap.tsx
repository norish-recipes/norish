"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/app/(app)/app-shell";
import CalendarPage from "@/app/(app)/calendar/page";
import GroceriesPage from "@/app/(app)/groceries/page";
import { matchOfflineRoute } from "@/lib/offline/offline-routes";

import { OfflineDashboard } from "./offline-dashboard";
import { OfflineRecipeDetail } from "./offline-recipe-detail";
import { OfflineUnavailable } from "./offline-unavailable";

/**
 * The offline bootstrap router (ADR-0009). The service worker serves this
 * precached document for any failed navigation, so the address bar still
 * holds the originally requested URL. After mount — never during the static
 * prerender, which must stay free of user data (ADR-0005) — it reads that
 * URL and boots the matching Warm Set surface under the full provider shell:
 * dashboard, warmed recipe detail, groceries, or calendar. Unwarmed recipes
 * and unsupported routes get the explicit Offline-unavailable state.
 */
export function OfflineBootstrap() {
  const [pathname, setPathname] = useState<string | null>(null);

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  if (pathname === null) {
    // The precached shell: exactly what the static prerender emitted.
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- the raw /logo.svg ships in the precached public/ scan; next/image needs a runtime endpoint. */}
        <img aria-hidden alt="" className="size-12 animate-pulse opacity-80" src="/logo.svg" />
      </main>
    );
  }

  const route = matchOfflineRoute(pathname);

  if (route.kind === "unsupported") {
    return (
      <AppShell>
        <OfflineUnavailable />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {route.kind === "dashboard" ? (
        <OfflineDashboard />
      ) : route.kind === "groceries" ? (
        <GroceriesPage />
      ) : route.kind === "calendar" ? (
        <CalendarPage />
      ) : (
        <OfflineRecipeDetail id={route.id} />
      )}
    </AppShell>
  );
}
