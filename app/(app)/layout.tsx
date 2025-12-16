import { AuthProviders } from "../providers/auth-providers";

import { Navbar } from "@/components/navbar/navbar";
import { UserProvider } from "@/context/user-context";
import { HouseholdProvider } from "@/context/household-context";
import { RecipesFiltersProvider } from "@/context/recipes-filters-context";
import { RecipesContextProvider } from "@/context/recipes-context";
import { PermissionsProvider } from "@/context/permissions-context";
import { ArchiveImportProvider } from "@/context/archive-import-context";

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
                    <main className="container mx-auto flex max-w-7xl flex-1 flex-col px-6 pt-10 pb-20 md:pb-6">
                      {children}
                    </main>
                  </div>
                </RecipesContextProvider>
              </RecipesFiltersProvider>
            </PermissionsProvider>
          </HouseholdProvider>
        </UserProvider>
      </ArchiveImportProvider>
    </AuthProviders>
  );
}
