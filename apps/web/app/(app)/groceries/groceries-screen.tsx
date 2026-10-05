import type { GroceryGroupSimilar, GroceryViewMode } from "@/lib/grocery-preferences";

import type { GroceriesView } from "./components/groceries-header";
import { GroceriesPage as GroceriesPageContent } from "./components/groceries-page";
import { PantryPage } from "./components/pantry-page";
import { GroceriesContextProvider } from "./context";
import { StoresContextProvider } from "./stores-context";

/**
 * The groceries surface shared by the Live route and the Offline bootstrap.
 *
 * The initial values come from the cookies the Live route read on the
 * server; the Offline bootstrap has no server pass and lets the provider
 * read them itself.
 */
export function GroceriesScreen({
  view = "list",
  initialViewMode,
  initialGroupSimilar,
}: {
  view?: GroceriesView;
  initialViewMode?: GroceryViewMode;
  initialGroupSimilar?: GroceryGroupSimilar;
}) {
  return (
    <StoresContextProvider>
      <GroceriesContextProvider
        initialGroupSimilar={initialGroupSimilar}
        initialViewMode={initialViewMode}
      >
        {view === "pantry" ? <PantryPage /> : <GroceriesPageContent />}
      </GroceriesContextProvider>
    </StoresContextProvider>
  );
}
