import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useListRecipeId } from "../use-list-entries";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

afterEach(resetTRPCFake);

function recipeIdFor(recipe: { id: string; householdId: string } | undefined) {
  serveTRPC(async () => ({ household: { id: "home", users: [] }, currentUserId: "me" }));

  return renderHook(() => useListRecipeId(recipe), {
    wrapper: createTestWrapper(createTestQueryClient(), fakePlatformAdapter()),
  });
}

describe("useListRecipeId", () => {
  it("passes no recipe for one of the reader's own household, so the household list's cache is read", async () => {
    const { result } = recipeIdFor({ id: "r1", householdId: "home" });

    await waitFor(() => expect(result.current).toBeUndefined());
  });

  it("passes the recipe for another household's, whose list it takes its entries from", async () => {
    const { result } = recipeIdFor({ id: "r1", householdId: "elsewhere" });

    await waitFor(() => expect(result.current).toBe("r1"));
  });

  it("passes nothing for a recipe that does not exist yet", () => {
    const { result } = recipeIdFor(undefined);

    expect(result.current).toBeUndefined();
  });
});
