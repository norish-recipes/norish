"use client";

import type { GroceryGroupSimilar, GroceryViewMode } from "@/lib/grocery-preferences";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PantryView } from "@/components/groceries";
import { motion } from "motion/react";

import type { GroceriesView } from "./components/groceries-header";
import { GroceriesHeader } from "./components/groceries-header";
import { GroceriesPage as GroceriesPageContent } from "./components/groceries-page";
import { GroceriesContextProvider } from "./context";
import { StoresContextProvider } from "./stores-context";

type InitialPreferences = {
  initialViewMode?: GroceryViewMode;
  initialGroupSimilar?: GroceryGroupSimilar;
};

/**
 * What both views of Groceries share and keep while switching: the list's
 * providers (the Pantry reads the household's groceries and creates them)
 * and the header. Only the view below it swaps, with a short fade, so
 * nothing above it moves or flickers.
 *
 * The initial values come from the cookies the Live route read on the
 * server; the Offline bootstrap has no server pass and lets the provider
 * read them itself.
 */
export function GroceriesShell({
  view,
  children,
  initialViewMode,
  initialGroupSimilar,
}: InitialPreferences & { view: GroceriesView; children: ReactNode }) {
  return (
    <StoresContextProvider>
      <GroceriesContextProvider
        initialGroupSimilar={initialGroupSimilar}
        initialViewMode={initialViewMode}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <GroceriesHeader view={view} />
          <motion.div
            key={view}
            animate={{ opacity: 1 }}
            className="flex min-h-0 w-full flex-1 flex-col"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </div>
      </GroceriesContextProvider>
    </StoresContextProvider>
  );
}

/** The Live routes' shell: the view is the address's. */
export function GroceriesRouteShell(props: InitialPreferences & { children: ReactNode }) {
  const view: GroceriesView = usePathname()?.startsWith("/groceries/pantry") ? "pantry" : "list";

  return <GroceriesShell view={view} {...props} />;
}

/** One view of Groceries as a whole screen, for the Offline bootstrap. */
export function GroceriesScreen({ view = "list" }: { view?: GroceriesView }) {
  return (
    <GroceriesShell view={view}>
      {view === "pantry" ? <PantryView /> : <GroceriesPageContent />}
    </GroceriesShell>
  );
}
