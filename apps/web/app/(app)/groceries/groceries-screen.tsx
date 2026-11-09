"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { PantryView } from "@/components/groceries";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { AnimatePresence, motion } from "motion/react";

import {
  useGroceriesSubscription,
  useGroceriesUiStore,
  usePantryQuery,
  usePantrySuggestions,
  useStoreAislesSubscription,
  useStorePricesSubscription,
  useStoresSubscription,
} from "@norish/shared-react/groceries";

import type { GroceriesView } from "./components/groceries-header";
import AddGroceryButton from "./components/add-grocery-button";
import { GroceriesHeader, VIEW_TRANSITION } from "./components/groceries-header";
import { GroceriesPage } from "./components/groceries-page";

/** Holds the Pantry's reads for its first visit; their changes render nothing but this. */
function PantryReads() {
  usePantryQuery();
  usePantrySuggestions();

  return null;
}

/** How far a view slides as it comes and goes, from its own side of the switch. */
const SLIDE_PX = 24;

/**
 * Both views under one header and the list's subscriptions: a switch only rewrites the address, and
 * what they keep current isn't read again. The Pantry is read here so its first visit lands whole.
 */
export function GroceriesScreen() {
  const view: GroceriesView = usePathname()?.startsWith("/groceries/pantry") ? "pantry" : "list";
  const offset = usePrefersReducedMotion() ? 0 : view === "pantry" ? SLIDE_PX : -SLIDE_PX;

  // The list's realtime, kept open on both views; the Offline Cache keeps its reads (gcTime).
  useGroceriesSubscription();
  useStoresSubscription();
  useStorePricesSubscription();
  useStoreAislesSubscription();

  const resetUi = useGroceriesUiStore((state) => state.reset);

  // The panels' store is global: leaving closes them for the next visit.
  useEffect(() => resetUi, [resetUi]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <PantryReads />
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
  );
}
