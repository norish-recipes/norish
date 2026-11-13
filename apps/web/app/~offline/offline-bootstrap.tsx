"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useState } from "react";
import DashboardPage from "@/app/(app)/(library)/(dashboard)/page";
import { AppShell } from "@/app/(app)/app-shell";
import CalendarPage from "@/app/(app)/calendar/page";
import { OfflineCookbook } from "@/app/~offline/offline-cookbook";
import { OfflineRecipeDetail } from "@/app/~offline/offline-recipe-detail";
import { OfflineUnavailable } from "@/app/~offline/offline-unavailable";
import { offlineEngine } from "@/lib/offline/engine";
import { readStoredRecipeFilters } from "@/lib/recipe-filters-storage";

import type { LibraryTypeFilter } from "@norish/shared/contracts";
import type { PersistedRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { DEFAULT_LIBRARY_TYPE_FILTER } from "@norish/shared/contracts";
import { addBasePath, stripBasePath } from "@norish/shared/lib/base-path";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface OfflineScreens {
  groceries: ReactNode;
  library: ComponentType<{ filters: PersistedRecipeFilters | undefined; children: ReactNode }>;
  recipe: ComponentType<{ recipeId: string; libraryType: LibraryTypeFilter }>;
  recipeSkeleton: ReactNode;
}

function offlineSurface(
  pathname: string,
  filters: PersistedRecipeFilters | null,
  { groceries, library: LibraryRoot, recipe, recipeSkeleton }: OfflineScreens
) {
  const path = pathname.replace(/(?<!\/)\/+$/, "") || "/";

  if (path === "/") {
    return (
      <LibraryRoot filters={filters ?? undefined}>
        <DashboardPage />
      </LibraryRoot>
    );
  }
  if (path === "/groceries" || path === "/groceries/pantry") return groceries;
  if (path === "/calendar") return <CalendarPage />;

  const recipeId = /^\/recipes\/([^/]+)$/.exec(path)?.[1];

  if (recipeId && UUID_RE.test(recipeId)) {
    return (
      <OfflineRecipeDetail
        Screen={recipe}
        id={recipeId.toLowerCase()}
        libraryType={filters?.libraryType ?? DEFAULT_LIBRARY_TYPE_FILTER}
        skeleton={recipeSkeleton}
      />
    );
  }

  const cookbookId = /^\/cookbooks\/([^/]+)$/.exec(path)?.[1];

  if (cookbookId && UUID_RE.test(cookbookId)) {
    return (
      <LibraryRoot filters={filters ?? undefined}>
        <OfflineCookbook id={cookbookId.toLowerCase()} />
      </LibraryRoot>
    );
  }

  return <OfflineUnavailable />;
}

/**
 * The offline bootstrap router (ADR-0009). The service worker serves this
 * precached document for any failed navigation, so the address bar still
 * holds the originally requested URL. After mount — never during the static
 * prerender, which must stay free of user data (ADR-0005) — it reads that
 * URL and boots the matching Warm Set surface under the full provider shell:
 * dashboard, warmed recipe detail, warmed cookbook, groceries, the Pantry, or
 * calendar.
 * Anything outside the floor and any unsupported route get the explicit
 * Offline-unavailable state.
 *
 * The worker serves this document only when a navigation failed, so the
 * reader is Offline: the last reader's cache is restored before anything
 * renders, and the first frame already carries their Device Preferences.
 * The page hands in the groceries and library roots, the recipe screen and its skeleton: only a
 * route file imports a screen.
 */
export function OfflineBootstrap(screens: OfflineScreens) {
  const [surface, setSurface] = useState<{
    pathname: string;
    filters: PersistedRecipeFilters | null;
  } | null>(null);

  // With no server, the Library's filters come from the browser's storage.
  useEffect(() => {
    void offlineEngine.cache.reconcileIdentity({ sessionUserId: null, isOffline: true }).then(() =>
      setSurface({
        pathname: stripBasePath(window.location.pathname),
        filters: readStoredRecipeFilters(),
      })
    );
  }, []);

  if (surface === null) {
    // The precached shell: exactly what the static prerender emitted.
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- the raw /logo-small.svg ships in the precached public/ scan; next/image needs a runtime endpoint. */}
        <img
          aria-hidden
          alt=""
          className="size-12 animate-pulse opacity-80"
          src={addBasePath("/logo-small.svg")}
        />
      </main>
    );
  }

  return <AppShell>{offlineSurface(surface.pathname, surface.filters, screens)}</AppShell>;
}
