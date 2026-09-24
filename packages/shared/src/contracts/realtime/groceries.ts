/**
 * Grocery realtime catalogue.
 *
 * Every event is household-scoped except `failed`: a validation failure on
 * one member's change toasts that member, not the whole household.
 */

import { z } from "zod";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";

import { defineRealtimeCatalogue } from "./catalogue";

export const groceriesRealtime = defineRealtimeCatalogue("grocery", {
  // z.custom: GroceryDto has no standalone zod schema yet.
  created: { scope: "household", payload: z.custom<{ groceries: GroceryDto[] }>() },
  // z.custom: GroceryDto has no standalone zod schema yet.
  updated: { scope: "household", payload: z.custom<{ changedGroceries: GroceryDto[] }>() },
  deleted: { scope: "household", payload: z.object({ groceryIds: z.array(z.string()) }) },
  // z.custom: RecurringGroceryDto and GroceryDto have no standalone zod schema yet.
  recurringCreated: {
    scope: "household",
    payload: z.custom<{ recurringGrocery: RecurringGroceryDto; grocery: GroceryDto }>(),
  },
  // z.custom: RecurringGroceryDto and GroceryDto have no standalone zod schema yet.
  recurringUpdated: {
    scope: "household",
    payload: z.custom<{ recurringGrocery: RecurringGroceryDto; grocery: GroceryDto }>(),
  },
  recurringDeleted: {
    scope: "household",
    payload: z.object({ recurringGroceryId: z.string() }),
  },
  failed: { scope: "user", payload: z.object({ reason: z.string() }) },
  /**
   * A version-guarded write was dropped because the row changed elsewhere.
   * Clients silently refetch so optimistic state converges to the database.
   */
  stale: { scope: "household", payload: z.object({ reason: z.string() }) },
});

export type GroceriesRealtime = typeof groceriesRealtime;
