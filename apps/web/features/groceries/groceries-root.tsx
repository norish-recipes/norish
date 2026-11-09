"use client";

import type { ReactNode } from "react";
import { useEffect, ViewTransition } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

import {
  useGroceriesSubscription,
  useGroceriesUiStore,
  useStoreAislesSubscription,
  useStorePricesSubscription,
  useStoresSubscription,
} from "@norish/shared-react/groceries";

import type { GroceriesView } from "./components/header";
import { GroceriesHeader, VIEW_TRANSITION } from "./components/header";
import { AddGroceryButton } from "./components/list";

/**
 * What the list and the Pantry share: the header with its switch, and the list's subscriptions.
 * Each view is a page of its own, rendered as `children`.
 */
export function GroceriesRoot({ children }: { children: ReactNode }) {
  const view: GroceriesView = usePathname()?.startsWith("/groceries/pantry") ? "pantry" : "list";
  const slide = `groceries-${view}`;

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
      <GroceriesHeader view={view} />
      {/* Keyed by the view, so a switch's navigation exits one page and enters the other, each
          from its own side of the switch (styles/globals.css). */}
      <ViewTransition key={view} default="none" enter={slide} exit={slide}>
        <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
      </ViewTransition>
      {/* The list's floating add pill lives out here: inside the page, the slide would capture it
          with the page and move it too. */}
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
