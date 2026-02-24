import { Navbar } from "@/components/navbar/navbar";
import { TimerDock } from "@/components/timer-dock";
import { ArchiveImportProvider } from "@/context/archive-import-context";
import { HouseholdProvider } from "@/context/household-context";
import { PermissionsProvider } from "@/context/permissions-context";
import { RecipesContextProvider } from "@/context/recipes-context";
import { RecipesFiltersProvider } from "@/context/recipes-filters-context";
import { UserProvider } from "@/context/user-context";

import { APP_MAIN_HORIZONTAL_PADDING_CLASS } from "@norish/web/config/css-tokens";

import { AuthProviders } from "../providers/auth-providers";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProviders>
      <ArchiveImportProvider>
        <UserProvider>
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
        </UserProvider>
      </ArchiveImportProvider>
    </AuthProviders>
  );
}
