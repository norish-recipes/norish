import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { IngredientNutrition } from "@norish/shared/contracts/ingredient-nutrition";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { readUnderWay } from "../../offline/testing";
import { keyOf, resetTRPCFake, sentCall } from "../../trpc/testing";
import { useNutritionCorrection } from "../use-ingredient-nutrition";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const NUTRITION = keyOf("ingredients.nutrition", { ingredientId: "onion" });

afterEach(resetTRPCFake);

describe("useNutritionCorrection", () => {
  it("keeps a read begun before the correction from landing over what it shows", async () => {
    const queryClient = createTestQueryClient();
    const held: IngredientNutrition = { numbers: null, pieceWeight: null, density: null };
    const shown: IngredientNutrition = {
      ...held,
      pieceWeight: { value: 110, source: { kind: "household" }, borrowedFrom: null },
    };

    queryClient.setQueryData(NUTRITION, held);
    const land = readUnderWay(queryClient, NUTRITION, held);
    const { result } = renderHook(() => useNutritionCorrection("onion"), {
      wrapper: createTestWrapper(queryClient, fakePlatformAdapter()),
    });

    act(() =>
      result.current.correct({ numbers: null, pieceWeight: { grams: 110 }, density: null }, shown)
    );
    await sentCall("ingredients.correctNutrition");
    await act(land);

    expect(queryClient.getQueryData(NUTRITION)).toEqual(shown);
  });
});
