import { AuthProviders } from "@/app/providers/auth-providers";
import { OfflineCacheController } from "@/app/providers/offline-cache-controller";
import { Navbar } from "@/components/navbar/navbar";
import { TimerDock } from "@/components/timer-dock";
import { ArchiveImportProvider } from "@/context/archive-import-context";
import { HouseholdProvider } from "@/context/household-context";
import { PermissionsProvider } from "@/context/permissions-context";
import { RecipesContextProvider } from "@/context/recipes-context";
import { RecipesFiltersProvider } from "@/context/recipes-filters-context";
import { UserProvider } from "@/context/user-context";

import { APP_MAIN_HORIZONTAL_PADDING_CLASS } from "@norish/web/config/css-tokens";

/**
 * The full authenticated app chrome: every provider plus navbar and main
 * container. One composition serves both the `(app)` layout and the offline
 * bootstrap (ADR-0009) — an unseen route served from the precached shell
 * boots the same providers client-side, so the Warm Set renders under the
 * exact tree the Live app uses.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProviders>
      <ArchiveImportProvider>
        <UserProvider>
          <OfflineCacheController>
            <HouseholdProvider>
              <PermissionsProvider>
                <RecipesFiltersProvider>
                  <RecipesContextProvider>
                    <div
                      data-app-container
                      className="relative flex min-h-dvh flex-col overflow-x-hidden"
                    >
                      <Navbar />
                      <main
                        className={`container mx-auto flex max-w-7xl flex-1 flex-col ${APP_MAIN_HORIZONTAL_PADDING_CLASS} pb-20 md:pb-6`}
                        style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}
                      >
                        {children}
                      </main>
                    </div>
                    <TimerDock />
                  </RecipesContextProvider>
                </RecipesFiltersProvider>
              </PermissionsProvider>
            </HouseholdProvider>
          </OfflineCacheController>
        </UserProvider>
      </ArchiveImportProvider>
    </AuthProviders>
  );
}
