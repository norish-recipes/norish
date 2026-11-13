import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRecipeId } from "../use-recipe-id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("useRecipeId", () => {
  it("hands back the existing id at once when editing", () => {
    const { result } = renderHook(() => useRecipeId("edit", "existing-id-123"));

    expect(result.current).toEqual({ recipeId: "existing-id-123", isLoading: false, error: null });
  });

  it("mints a uuid on the client when creating, with no backend round-trip", async () => {
    const { result } = renderHook(() => useRecipeId("create"));

    await waitFor(() => expect(result.current.recipeId).toMatch(UUID_RE));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("keeps the same id across renders", async () => {
    const { result, rerender } = renderHook(() => useRecipeId("create"));

    await waitFor(() => expect(result.current.recipeId).toMatch(UUID_RE));
    const first = result.current.recipeId;

    rerender();

    expect(result.current.recipeId).toBe(first);
  });

  it("mints a fresh id when the create page mounts again", async () => {
    const first = renderHook(() => useRecipeId("create"));

    await waitFor(() => expect(first.result.current.recipeId).toMatch(UUID_RE));
    const firstId = first.result.current.recipeId;

    first.unmount();

    const second = renderHook(() => useRecipeId("create"));

    await waitFor(() => expect(second.result.current.recipeId).toMatch(UUID_RE));
    expect(second.result.current.recipeId).not.toBe(firstId);
  });
});
