import type { DevicePreferencesSeed } from "@/context/device-preferences-context";
import type { DehydratedState } from "@tanstack/react-query";
import { AuthProviders } from "@/app/providers/auth-providers";
import { OfflineCacheController } from "@/app/providers/offline-cache-controller";
import { ArrivalScroll } from "@/components/arrival-scroll";
import { Navbar } from "@/components/navbar/navbar";
import { QuerySeedBoundary } from "@/components/query-seed-boundary";
import { ReaderTodayProvider } from "@/components/reader-today";
import AIKeyRejectionPrompt from "@/components/shared/ai-key-rejection-prompt";
import ClipboardImportPrompt from "@/components/shared/clipboard-import-prompt";
import { TimerDock } from "@/components/timer-dock";
import { ArchiveImportProvider } from "@/context/archive-import-context";
import { CookbooksRealtimeProvider } from "@/context/cookbooks-realtime-context";
import { DevicePreferencesProvider } from "@/context/device-preferences-context";
import { HouseholdProvider } from "@/context/household-context";
import { IngredientsRealtime } from "@/context/ingredients-realtime";
import { PantryRealtimeProvider } from "@/context/pantry-realtime-context";
import { PermissionsProvider } from "@/context/permissions-context";
import { RecipesContextProvider } from "@/context/recipes-context";
import { RecipesFiltersProvider } from "@/context/recipes-filters-context";
import { UserProvider } from "@/context/user-context";

import type { PersistedRecipeFilters } from "@norish/shared-react/filter-contract";
import type { User } from "@norish/shared/contracts";
import {
  APP_MAIN_BOTTOM_PADDING_CLASS,
  APP_MAIN_HORIZONTAL_PADDING_CLASS,
} from "@norish/web/config/css-tokens";

/**
 * The full authenticated app chrome: every provider plus navbar and main
 * container. One composition serves both the `(app)` layout and the offline
 * bootstrap (ADR-0009) — an unseen route served from the precached shell
 * boots the same providers client-side, so the Warm Set renders under the
 * exact tree the Live app uses.
 */
export function AppShell({
  children,
  devicePreferences,
  reader,
  readerToday,
  recipeFilters,
  seed,
}: {
  children: React.ReactNode;
  /** The profile's Device Preferences as the layout's server pass read them; absent offline. */
  devicePreferences?: DevicePreferencesSeed;
  /** The reader the layout verified: drawn until the session answers, and the Offline Cache
   * restores theirs at hydration. Absent offline. */
  reader?: User;
  /** The reader's date in their time zone, as the layout read it; absent offline. */
  readerToday?: string;
  /** The Library filters from the browser's cookie; absent offline or without one. */
  recipeFilters?: PersistedRecipeFilters;
  /** What the shell's providers read, sent with a full load; absent offline. */
  seed?: DehydratedState;
}) {
  return (
    <ReaderTodayProvider value={readerToday}>
      <AuthProviders>
        {/* Above the providers that read it, so its queries are new to the cache and fill in render. */}
        <QuerySeedBoundary state={seed}>
          <ArchiveImportProvider>
            <UserProvider reader={reader}>
              <OfflineCacheController seededUserId={reader?.id}>
                <DevicePreferencesProvider seed={devicePreferences}>
                  <HouseholdProvider>
                    <PermissionsProvider>
                      <RecipesFiltersProvider initialFilters={recipeFilters}>
                        <RecipesContextProvider>
                          <CookbooksRealtimeProvider>
                            <PantryRealtimeProvider>
                              <div
                                data-app-container
                                className="relative flex min-h-dvh flex-col overflow-x-hidden"
                              >
                                {/* Installed-PWA polish: content scrolls under the translucent
                          status bar (viewport-fit: cover), so a soft background fade
                          masks it instead of a hard clip. Mobile-only — desktop has
                          no status bar — and height collapses to the small tail
                          where the safe-area inset is zero. Below the nav's z-60,
                          above content; theme-aware via the background token. */}
                                <div
                                  aria-hidden
                                  className="from-background via-background/80 dark:via-background/80 pointer-events-none fixed inset-x-0 top-0 z-50 bg-gradient-to-b via-35% to-transparent md:hidden dark:via-40%"
                                  style={{
                                    height: "calc(env(safe-area-inset-top, 0px) + 0.85rem)",
                                  }}
                                />
                                <Navbar />
                                <main
                                  className={`container mx-auto flex max-w-7xl flex-1 flex-col ${APP_MAIN_HORIZONTAL_PADDING_CLASS} ${APP_MAIN_BOTTOM_PADDING_CLASS}`}
                                  style={{
                                    paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
                                  }}
                                >
                                  {children}
                                </main>
                                <ArrivalScroll />
                              </div>
                              <TimerDock />
                              <ClipboardImportPrompt />
                              <AIKeyRejectionPrompt />
                              <IngredientsRealtime />
                            </PantryRealtimeProvider>
                          </CookbooksRealtimeProvider>
                        </RecipesContextProvider>
                      </RecipesFiltersProvider>
                    </PermissionsProvider>
                  </HouseholdProvider>
                </DevicePreferencesProvider>
              </OfflineCacheController>
            </UserProvider>
          </ArchiveImportProvider>
        </QuerySeedBoundary>
      </AuthProviders>
    </ReaderTodayProvider>
  );
}
