import { fakeProcedure } from "@/__tests__/helpers/trpc-fake";
import { useAutoConversion } from "@/app/(app)/recipes/[id]/components/use-system-conversion";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRecipePage } from "./recipe-page";

const mocks = vi.hoisted(() => ({
  measurementSystem: undefined as string | undefined,
  isAIEnabled: false,
  canEdit: true,
}));

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);

vi.mock("@/hooks/user/use-user-query", () => ({
  useUserSettingsQuery: () => ({
    user: { preferences: { measurementSystem: mocks.measurementSystem } },
  }),
}));

vi.mock("@norish/shared-react/reader", async () =>
  (await import("@/__tests__/helpers/reader-mock")).mockReader(() => ({
    permissions: { isAIEnabled: mocks.isAIEnabled },
    canEditRecipe: () => mocks.canEdit,
  }))
);

vi.mock("@/hooks/user/use-hidden-item-visibility", () => ({
  useHiddenItemVisibility: () => ({ showConversion: true }),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const metricRecipe = (copies: ("metric" | "us")[] = ["metric"]) => ({
  id: "r1",
  userId: "owner",
  version: 1,
  systemUsed: "metric" as const,
  recipeIngredients: copies.map((systemUsed) => ({ systemUsed })),
  steps: [],
});

/** The hook on a page showing `recipe`; `page().conversion` is the convert it pressed. */
function renderOn(recipe = metricRecipe()) {
  const onPage = onRecipePage(recipe);

  return { ...onPage, ...renderHook(() => useAutoConversion(), { wrapper: onPage.wrapper }) };
}

beforeEach(() => {
  mocks.measurementSystem = undefined;
  mocks.isAIEnabled = false;
  mocks.canEdit = true;
});

describe("useAutoConversion", () => {
  it("leaves the recipe alone without a chosen system", () => {
    const { page } = renderOn();

    expect(page().conversion).toBeNull();
  });

  it("presses convert for the chosen system, and only once per recipe", () => {
    mocks.measurementSystem = "us";

    const { page, queryClient } = renderOn();
    const pressed = page().conversion;

    expect(pressed).toMatchObject({ target: "us", withAI: false });

    // Someone switches it back while it is open: it stays switched.
    act(() =>
      queryClient.setQueryData(
        fakeProcedure("recipes.get").queryKey({ id: "r1" }),
        metricRecipe(["metric", "us"])
      )
    );

    expect(page().conversion).toBe(pressed);
  });

  it("waits for the server's copy, since the saved one may be behind", async () => {
    mocks.measurementSystem = "us";

    const onPage = onRecipePage(metricRecipe());
    let answer: (recipe: unknown) => void = () => {};
    const answered = new Promise((resolve) => (answer = resolve));
    const read = onPage.queryClient.fetchQuery({
      queryKey: fakeProcedure("recipes.get").queryKey({ id: "r1" }),
      queryFn: () => answered,
      staleTime: 0,
    });

    renderHook(() => useAutoConversion(), { wrapper: onPage.wrapper });

    expect(onPage.page().conversion).toBeNull();

    await act(async () => {
      answer(metricRecipe());
      await read;
    });

    await vi.waitFor(() =>
      expect(onPage.page().conversion).toMatchObject({ target: "us", withAI: false })
    );
  });

  it("writes a missing copy with AI, and switches to one already there", () => {
    mocks.measurementSystem = "usWithAI";
    mocks.isAIEnabled = true;

    expect(renderOn().page().conversion).toMatchObject({ target: "us", withAI: true });
    expect(renderOn(metricRecipe(["metric", "us"])).page().conversion).toMatchObject({
      target: "us",
      withAI: false,
    });
  });

  it("converts without AI where an administrator has AI off", () => {
    mocks.measurementSystem = "usWithAI";

    expect(renderOn().page().conversion).toMatchObject({ target: "us", withAI: false });
  });

  it("does nothing for a recipe already in the system, or one the reader may not convert", () => {
    mocks.measurementSystem = "metric";
    expect(renderOn().page().conversion).toBeNull();

    mocks.measurementSystem = "us";
    mocks.canEdit = false;
    expect(renderOn().page().conversion).toBeNull();
  });
});
