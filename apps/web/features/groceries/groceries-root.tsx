"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { AnimatePresence, motion } from "motion/react";

import { useIngredientsSubscription } from "@norish/shared-react/config";
import {
  useGroceriesSubscription,
  useGroceriesUiStore,
  usePantrySubscription,
  useStoreAislesSubscription,
  useStorePricesSubscription,
  useStoresSubscription,
} from "@norish/shared-react/groceries";

import { GroceriesHeader, VIEW_TRANSITION } from "./components/header/groceries-header";
import AddGroceryButton from "./components/list/add-grocery-button";
import { GroceriesListScreen } from "./groceries-list-screen";
import { groceriesView } from "./lib/groceries-view";
import { PantryScreen } from "./pantry-screen";

/** How far a view slides as it comes and goes, from its own side of the switch. */
const SLIDE_PX = 24;

/**
 * What the list and the Pantry share: the header with its switch, the list's subscriptions and the
 * add pill. The switch only rewrites the address, so the view changes here, with no navigation.
 */
export function GroceriesRoot() {
  const view = groceriesView(usePathname());
  const offset = usePrefersReducedMotion() ? 0 : view === "pantry" ? SLIDE_PX : -SLIDE_PX;

  // The list's realtime, kept open on both views; the Offline Cache keeps its reads (gcTime).
  useGroceriesSubscription();
  useStoresSubscription();
  useStorePricesSubscription();
  useStoreAislesSubscription();
  usePantrySubscription();
  useIngredientsSubscription();

  const resetUi = useGroceriesUiStore((state) => state.reset);

  // The panels' store is global: leaving closes them for the next visit.
  useEffect(() => resetUi, [resetUi]);

  return (
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
            {view === "pantry" ? <PantryScreen /> : <GroceriesListScreen />}
          </motion.div>
        </AnimatePresence>
      </div>
      {/* The add pill lives out here: a sliding view is transformed, which would pin the fixed
          pill to the view instead of the screen until the slide ends. */}
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
  );
}
