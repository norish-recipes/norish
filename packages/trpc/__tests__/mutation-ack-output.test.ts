import type { inferRouterOutputs } from "@trpc/server";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { MutationAck } from "@norish/shared/contracts";

import type { AppRouter } from "../src/router";
import {
  deletePlannedRecipeOutputSchema,
  plannedRecipeMutationOutputSchema,
} from "../src/routers/calendar/planned-items-openapi-types";
import {
  deleteGroceryOutputSchema,
  groceryMutationOutputSchema,
} from "../src/routers/groceries/groceries-openapi-types";

type RouterOutputs = inferRouterOutputs<AppRouter>;

describe("mutation acknowledgement output contracts", () => {
  it("keeps acknowledgement fields through OpenAPI output validation", () => {
    expect(
      groceryMutationOutputSchema.parse({
        success: true,
        applied: true,
        grocery: null,
      })
    ).toEqual({ success: true, applied: true, grocery: null });

    expect(
      groceryMutationOutputSchema.parse({
        success: true,
        applied: false,
        stale: true,
        grocery: null,
      })
    ).toEqual({ success: true, applied: false, stale: true, grocery: null });

    expect(deleteGroceryOutputSchema.parse({ success: true, applied: true })).toEqual({
      success: true,
      applied: true,
    });

    expect(
      plannedRecipeMutationOutputSchema.parse({
        success: true,
        applied: false,
        stale: true,
        id: crypto.randomUUID(),
      })
    ).toMatchObject({ success: true, applied: false, stale: true });

    expect(
      deletePlannedRecipeOutputSchema.parse({ success: true, applied: false, stale: true })
    ).toEqual({ success: true, applied: false, stale: true });
  });

  it("exposes MutationAck-compatible results for converted procedures", () => {
    expectTypeOf<RouterOutputs["groceries"]["update"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["groceries"]["reorderInStore"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["groceries"]["markAllDone"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["groceries"]["deleteDone"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["groceries"]["updateRecurring"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["groceries"]["detachRecurring"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["groceries"]["deleteRecurring"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["groceries"]["checkRecurring"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["ratings"]["rate"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["stores"]["delete"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["households"]["create"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["households"]["join"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["households"]["leave"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["households"]["kick"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["households"]["regenerateCode"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["households"]["transferAdmin"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["recipes"]["update"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["recipes"]["delete"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["recipes"]["convertMeasurements"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["calendar"]["createItem"]>().toMatchTypeOf<MutationAck>();
    expectTypeOf<RouterOutputs["calendar"]["deleteItem"]>().toMatchTypeOf<MutationAck>();
  });
});
