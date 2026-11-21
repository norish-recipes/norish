import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import type { IngredientItem } from "../types";
import { readUnderWay } from "../../offline/testing";
import { keyOf } from "../../trpc/testing";
import { useIngredientCache } from "../use-ingredient-cache";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const onion: IngredientItem = {
  id: "onion",
  name: "onion",
  flagged: false,
  flagReason: null,
  parent: null,
  kinds: 0,
  canEdit: true,
  aliases: [],
};
const KINDS = keyOf("ingredients.kinds", { parentId: "veg" });

describe("useIngredientCache", () => {
  it("keeps a read begun before a patch from landing over it", async () => {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(KINDS, [onion]);
    const land = readUnderWay(queryClient, KINDS, [onion]);
    const { result } = renderHook(() => useIngredientCache(), {
      wrapper: createTestWrapper(queryClient),
    });

    act(() => result.current.patchRow("onion", (item) => ({ ...item, name: "red onion" })));
    await act(land);

    expect(queryClient.getQueryData(KINDS)).toEqual([{ ...onion, name: "red onion" }]);
  });
});
