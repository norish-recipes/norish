"use client";

import type { GroceryGroupSimilar, GroceryViewMode } from "@/lib/grocery-preferences";
import { usePathname } from "next/navigation";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { PantryView } from "@/components/groceries";
import { usePantryQuery, usePantrySuggestions } from "@/hooks/pantry";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type { GroceriesView } from "./components/groceries-header";
import AddGroceryButton from "./components/add-grocery-button";
import { GroceriesHeader, VIEW_TRANSITION } from "./components/groceries-header";
import { GroceriesPage } from "./components/groceries-page";
import { GroceriesContextProvider } from "./context";
import { StoresContextProvider } from "./stores-context";

/** How far a view slides as it comes and goes, from its own side of the switch. */
const SLIDE_PX = 24;

/**
 * Groceries as a whole screen, on both of its views: the list's providers
 * (the Pantry reads the household's groceries and creates them), the header,
 * and the view the address names. The switch only rewrites the address, so
 * changing views asks the server for nothing: the view slides out towards its
 * own side of the switch while the other slides in from its side, and nothing
 * above them moves. The Pantry is read while the list shows, so its first
 * visit lands whole rather than as a skeleton.
 *
 * The Live route passes the cookies' values, read on the server; the Offline
 * bootstrap has no server pass and lets the provider read them itself.
 */
export function GroceriesScreen({
  initialViewMode,
  initialGroupSimilar,
}: {
  initialViewMode?: GroceryViewMode;
  initialGroupSimilar?: GroceryGroupSimilar;
}) {
  const view: GroceriesView = usePathname()?.startsWith("/groceries/pantry") ? "pantry" : "list";
  const offset = useReducedMotion() ? 0 : view === "pantry" ? SLIDE_PX : -SLIDE_PX;
  const { isOffline } = useConnectivity();

  usePantryQuery();
  usePantrySuggestions(!isOffline);

  return (
    <StoresContextProvider>
      <GroceriesContextProvider
        initialGroupSimilar={initialGroupSimilar}
        initialViewMode={initialViewMode}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <GroceriesHeader view={view} />
          <div className="relative flex min-h-0 w-full flex-1 flex-col">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={view}
                animate={{ opacity: 1, x: 0 }}
                className="flex min-h-0 w-full flex-1 flex-col"
                exit={{ opacity: 0, x: offset }}
                initial={{ opacity: 0, x: offset }}
                transition={VIEW_TRANSITION}
              >
                {view === "pantry" ? <PantryView /> : <GroceriesPage />}
              </motion.div>
            </AnimatePresence>
          </div>
          {/* The list's floating add pill lives out here: a sliding view is
              transformed, which would pin a fixed pill to the view instead of
              the screen until the slide ends. */}
          <AnimatePresence initial={false}>
            {view === "list" ? (
              <motion.div
                key="add"
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                transition={VIEW_TRANSITION}
              >
                <AddGroceryButton />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </GroceriesContextProvider>
    </StoresContextProvider>
  );
}
