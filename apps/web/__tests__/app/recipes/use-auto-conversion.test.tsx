import { useAutoConversion } from "@/app/(app)/recipes/[id]/components/use-system-conversion";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  measurementSystem: undefined as string | undefined,
  isAIEnabled: false,
  canEdit: true,
  isFetching: false,
  recipe: null as null | {
    id: string;
    userId: string;
    systemUsed: "metric" | "us";
    recipeIngredients: { systemUsed: "metric" | "us" }[];
  },
  startConversion: vi.fn(),
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContext: () => ({
    recipe: mocks.recipe,
    isFetching: mocks.isFetching,
    convertingTo: null,
    startConversion: mocks.startConversion,
  }),
  useRecipeContextRequired: () => {
    throw new Error("not used");
  },
}));

vi.mock("@/hooks/user/use-user-query", () => ({
  useUserSettingsQuery: () => ({
    user: { preferences: { measurementSystem: mocks.measurementSystem } },
  }),
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({
    isAIEnabled: mocks.isAIEnabled,
    isLoading: false,
    canEditRecipe: () => mocks.canEdit,
  }),
}));

vi.mock("@/hooks/user/use-hidden-item-visibility", () => ({
  useHiddenItemVisibility: () => ({ showConversion: true }),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const metricRecipe = (copies: ("metric" | "us")[] = ["metric"]) => ({
  id: "r1",
  userId: "owner",
  systemUsed: "metric" as const,
  recipeIngredients: copies.map((systemUsed) => ({ systemUsed })),
});

beforeEach(() => {
  mocks.measurementSystem = undefined;
  mocks.isAIEnabled = false;
  mocks.canEdit = true;
  mocks.isFetching = false;
  mocks.recipe = metricRecipe();
  mocks.startConversion.mockClear();
});

describe("useAutoConversion", () => {
  it("leaves the recipe alone without a chosen system", () => {
    renderHook(() => useAutoConversion());

    expect(mocks.startConversion).not.toHaveBeenCalled();
  });

  it("presses convert for the chosen system, and only once per recipe", () => {
    mocks.measurementSystem = "us";

    const { rerender } = renderHook(() => useAutoConversion());

    expect(mocks.startConversion).toHaveBeenCalledWith("us", false);

    // Someone switches it back while it is open: it stays switched.
    mocks.recipe = { ...metricRecipe(["metric", "us"]) };
    rerender();

    expect(mocks.startConversion).toHaveBeenCalledTimes(1);
  });

  it("waits for the server's copy, since the saved one may be behind", () => {
    mocks.measurementSystem = "us";
    mocks.isFetching = true;

    const { rerender } = renderHook(() => useAutoConversion());

    expect(mocks.startConversion).not.toHaveBeenCalled();

    mocks.isFetching = false;
    rerender();

    expect(mocks.startConversion).toHaveBeenCalledWith("us", false);
  });

  it("writes a missing copy with AI, and switches to one already there", () => {
    mocks.measurementSystem = "usWithAI";
    mocks.isAIEnabled = true;

    renderHook(() => useAutoConversion());
    expect(mocks.startConversion).toHaveBeenLastCalledWith("us", true);

    mocks.recipe = metricRecipe(["metric", "us"]);
    mocks.startConversion.mockClear();
    renderHook(() => useAutoConversion());
    expect(mocks.startConversion).toHaveBeenLastCalledWith("us", false);
  });

  it("converts without AI where an administrator has AI off", () => {
    mocks.measurementSystem = "usWithAI";

    renderHook(() => useAutoConversion());

    expect(mocks.startConversion).toHaveBeenCalledWith("us", false);
  });

  it("does nothing for a recipe already in the system, or one the reader may not convert", () => {
    mocks.measurementSystem = "metric";
    renderHook(() => useAutoConversion());

    mocks.measurementSystem = "us";
    mocks.canEdit = false;
    renderHook(() => useAutoConversion());

    expect(mocks.startConversion).not.toHaveBeenCalled();
  });
});
