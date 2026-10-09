/**
 * The scaler hands back amounts as numbers, at the original servings as well
 * as scaled: the groceries panel formats them with toFixed, and a string
 * amount like "0.5" crashed it.
 */

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { ScaledIngredient } from "../../src/hooks/use-servings-scaler";
import { useServingsScaler } from "../../src/hooks/use-servings-scaler";
import { renderHookWithClient } from "./render-hook";

type Line = { id: string; amount: number | string | null };

function scale(lines: Line[], original: number, initial: number) {
  let result: ScaledIngredient<Line>[] = [];
  const { unmount } = renderHookWithClient(new QueryClient(), () => {
    result = useServingsScaler(lines, original, initial).scaledIngredients;
  });

  unmount();

  return result.map((line) => line.amount);
}

describe("useServingsScaler", () => {
  const lines: Line[] = [
    { id: "a", amount: 0.5 },
    { id: "b", amount: "1.5" },
    { id: "c", amount: null },
  ];

  it("keeps amounts as numbers at the original servings", () => {
    expect(scale(lines, 2, 2)).toEqual([0.5, 1.5, null]);
  });

  it("scales amounts as numbers", () => {
    expect(scale(lines, 3, 2)).toEqual([0.3333, 1, null]);
  });
});
