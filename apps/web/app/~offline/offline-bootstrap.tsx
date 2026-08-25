"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/app/(app)/app-shell";
import CalendarPage from "@/app/(app)/calendar/page";
import { GroceriesScreen } from "@/app/(app)/groceries/groceries-screen";
import { OfflineCookbook } from "@/app/~offline/offline-cookbook";
import { OfflineRecipeDetail } from "@/app/~offline/offline-recipe-detail";
import { OfflineUnavailable } from "@/app/~offline/offline-unavailable";
import { Dashboard } from "@/components/dashboard/dashboard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function offlineSurface(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/") return <Dashboard />;
  if (path === "/groceries") return <GroceriesScreen />;
  if (path === "/calendar") return <CalendarPage />;

  const recipeId = /^\/recipes\/([^/]+)$/.exec(path)?.[1];

  if (recipeId && UUID_RE.test(recipeId)) {
    return <OfflineRecipeDetail id={recipeId.toLowerCase()} />;
  }

  const cookbookId = /^\/cookbooks\/([^/]+)$/.exec(path)?.[1];

  if (cookbookId && UUID_RE.test(cookbookId)) {
    return <OfflineCookbook id={cookbookId.toLowerCase()} />;
  }

  return <OfflineUnavailable />;
}

/**
 * The offline bootstrap router (ADR-0009). The service worker serves this
 * precached document for any failed navigation, so the address bar still
 * holds the originally requested URL. After mount — never during the static
 * prerender, which must stay free of user data (ADR-0005) — it reads that
 * URL and boots the matching Warm Set surface under the full provider shell:
 * dashboard, warmed recipe detail, warmed cookbook, groceries, or calendar.
 * Anything outside the floor and any unsupported route get the explicit
 * Offline-unavailable state.
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

  return <AppShell>{offlineSurface(pathname)}</AppShell>;
}
