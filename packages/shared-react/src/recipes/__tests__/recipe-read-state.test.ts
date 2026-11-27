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
    ["ready", { recipe, error: null, isFetching: false, isOffline: false }],
    [
      "ready, a refetch failing",
      { recipe, error: new Error("Busy"), isFetching: false, isOffline: false },
    ],
    ["ready, held offline", { recipe, error: null, isFetching: false, isOffline: true }],
    ["loading", { recipe: null, error: null, isFetching: true, isOffline: false }],
    ["not-found", { recipe: null, error: notFound, isFetching: false, isOffline: false }],
    ["not-found, offline", { recipe: null, error: notFound, isFetching: false, isOffline: true }],
    ["offline, nothing held", { recipe: null, error: null, isFetching: true, isOffline: true }],
    [
      "offline, the read failed",
      { recipe: null, error: new Error("Busy"), isFetching: false, isOffline: true },
    ],
    ["failed", { recipe: null, error: new Error("Busy"), isFetching: false, isOffline: false }],
    [
      "loading, read again",
      { recipe: null, error: new Error("Busy"), isFetching: true, isOffline: false },
    ],
  ] as const)("is %s", (state, read) => {
    expect(recipeReadState(read)).toBe(state.split(",")[0]);
  });
});
