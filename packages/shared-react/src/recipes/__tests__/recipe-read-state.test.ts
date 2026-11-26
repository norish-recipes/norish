import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";

import { recipeReadState } from "../use-recipe-query";

const recipe = { id: "r1" } as FullRecipeDTO;
const notFound = new TRPCClientError("Not found", {
  result: { error: { data: { code: "NOT_FOUND" } } } as never,
});

describe("recipeReadState", () => {
  it.each([
    ["ready", { recipe, error: null, isFetching: false }],
    ["ready, a refetch failing", { recipe, error: new Error("Busy"), isFetching: false }],
    ["loading", { recipe: null, error: null, isFetching: true }],
    ["not-found", { recipe: null, error: notFound, isFetching: false }],
    ["failed", { recipe: null, error: new Error("Busy"), isFetching: false }],
    ["loading, read again", { recipe: null, error: new Error("Busy"), isFetching: true }],
  ] as const)("is %s", (state, read) => {
    expect(recipeReadState(read)).toBe(state.split(",")[0]);
  });
});
