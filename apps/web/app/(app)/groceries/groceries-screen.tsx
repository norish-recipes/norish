"use client";

import { usePathname } from "next/navigation";
import { PantryView } from "@/components/groceries";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";

import {
  useGroceriesSubscription,
  useStoreAislesSubscription,
  useStorePricesSubscription,
  useStoresSubscription,
} from "@norish/shared-react/groceries";
import { useConnectivity } from "@norish/shared-react/offline/react";
import { useTRPC } from "@norish/shared-react/trpc";

import type { GroceriesView } from "./components/groceries-header";
import AddGroceryButton from "./components/add-grocery-button";
import { GroceriesHeader, VIEW_TRANSITION } from "./components/groceries-header";
import { GroceriesPage } from "./components/groceries-page";
import { GroceriesUiProvider } from "./context";

/** How far a view slides as it comes and goes, from its own side of the switch. */
const SLIDE_PX = 24;

/**
 * Both views under one header and the list's subscriptions: a switch only rewrites the address, and
 * what they keep current isn't read again. The Pantry is read here so its first visit lands whole.
 */
export function GroceriesScreen() {
  const view: GroceriesView = usePathname()?.startsWith("/groceries/pantry") ? "pantry" : "list";
  const offset = usePrefersReducedMotion() ? 0 : view === "pantry" ? SLIDE_PX : -SLIDE_PX;
  const { isOffline } = useConnectivity();
  const trpc = useTRPC();

  // Observed so they stay cached and current, but a change to them never renders the screen.
  useQuery({ ...trpc.pantry.list.queryOptions(), notifyOnChangeProps: [] });
  useQuery({
    ...trpc.pantry.suggestions.queryOptions(),
    enabled: !isOffline,
    notifyOnChangeProps: [],
  });
  // The list's realtime, kept open on both views; the Offline Cache keeps its reads (gcTime).
  useGroceriesSubscription();
  useStoresSubscription();
  useStorePricesSubscription();
  useStoreAislesSubscription();

  return (
    <GroceriesUiProvider>
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
    </GroceriesUiProvider>
  );
}
