import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MEASUREMENT_SYSTEM_CHOICES } from "@norish/shared/contracts/zod/user";
import { createTestQueryClient } from "@norish/shared-react/platform/testing";

import { keyOf, resetTRPCFake } from "../../trpc/testing";
import { RecipePageProvider, useRecipePageStore } from "../recipe-page-store";
import { useAutoConversion, useSystemConversion } from "../use-system-conversion";

const mocks = vi.hoisted(() => ({
  measurementSystem: undefined as (typeof MEASUREMENT_SYSTEM_CHOICES)[number] | undefined,
  isAIEnabled: false,
  canEdit: true,
  showConversion: true,
}));

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

vi.mock("../../reader", () => ({
  ownerAllows: (_owner: string, can: (id: string) => boolean) => can(_owner),
  useProfileQuery: () => ({
    user: { preferences: { measurementSystem: mocks.measurementSystem } },
  }),
  usePermissions: <T,>(select: (p: { isAIEnabled: boolean }) => T) =>
    select({ isAIEnabled: mocks.isAIEnabled }),
  useHiddenItemVisibility: () => ({ showConversion: mocks.showConversion }),
  useRecipePermissions: () => ({ isLoading: false, canEditRecipe: () => mocks.canEdit }),
}));

const RECIPE_KEY = keyOf("recipes.get", { id: "r1" });

const metricRecipe = (copies: ("metric" | "us")[] = ["metric"], systemUsed = "metric") => ({
  id: "r1",
  userId: "owner",
  version: 1,
  systemUsed,
  recipeIngredients: copies.map((copy) => ({ systemUsed: copy })),
  steps: [],
});

/** The hook on a page showing `recipe`; `page().conversion` is the convert it pressed. */
function renderOn<T>(hook: () => T, recipe: object = metricRecipe()) {
  const queryClient = createTestQueryClient();
  let state: { conversion: unknown } | undefined;

  queryClient.setQueryDefaults([], { staleTime: Infinity });
  queryClient.setQueryData(RECIPE_KEY, recipe);

  function Probe() {
    state = useRecipePageStore((page) => page);

    return null;
  }

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <RecipePageProvider recipeId="r1">
          <Probe />
          {children}
        </RecipePageProvider>
      </QueryClientProvider>
    );
  }

  const page = () => state!;

  return { queryClient, page, ...renderHook(hook, { wrapper }) };
}

beforeEach(() => {
  resetTRPCFake();
  mocks.measurementSystem = undefined;
  mocks.isAIEnabled = false;
  mocks.canEdit = true;
  mocks.showConversion = true;
});

describe("useAutoConversion", () => {
  it("leaves the recipe alone without a chosen system", () => {
    expect(renderOn(() => useAutoConversion()).page().conversion).toBeNull();
  });

  it("presses convert for the chosen system, and only once per recipe", () => {
    mocks.measurementSystem = "us";

    const { page, queryClient } = renderOn(() => useAutoConversion());
    const pressed = page().conversion;

    expect(pressed).toMatchObject({ target: "us", withAI: false });

    // Someone switches it back while it is open: it stays switched.
    act(() => queryClient.setQueryData(RECIPE_KEY, metricRecipe(["metric", "us"])));

    expect(page().conversion).toBe(pressed);
  });

  it("waits for the server's copy, since the saved one may be behind", async () => {
    mocks.measurementSystem = "us";

    const queryClient = createTestQueryClient();
    let answer: (recipe: unknown) => void = () => {};
    const answered = new Promise((resolve) => (answer = resolve));

    queryClient.setQueryData(RECIPE_KEY, metricRecipe());
    const read = queryClient.fetchQuery({
      queryKey: RECIPE_KEY,
      queryFn: () => answered,
      staleTime: 0,
    });
    let conversion: unknown = null;

    function Probe() {
      conversion = useRecipePageStore((page) => page.conversion);
      useAutoConversion();

      return null;
    }

    renderHook(() => null, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          <RecipePageProvider recipeId="r1">
            <Probe />
            {children}
          </RecipePageProvider>
        </QueryClientProvider>
      ),
    });

    expect(conversion).toBeNull();

    await act(async () => {
      answer(metricRecipe());
      await read;
    });

    await vi.waitFor(() => expect(conversion).toMatchObject({ target: "us", withAI: false }));
  });

  it("writes a missing copy with AI, and switches to one already there", () => {
    mocks.measurementSystem = "usWithAI";
    mocks.isAIEnabled = true;

    expect(renderOn(() => useAutoConversion()).page().conversion).toMatchObject({
      target: "us",
      withAI: true,
    });
    expect(
      renderOn(() => useAutoConversion(), metricRecipe(["metric", "us"])).page().conversion
    ).toMatchObject({ target: "us", withAI: false });
  });

  it("converts without AI where an administrator has AI off", () => {
    mocks.measurementSystem = "usWithAI";

    expect(renderOn(() => useAutoConversion()).page().conversion).toMatchObject({
      target: "us",
      withAI: false,
    });
  });

  it("does nothing for a recipe already in the system, or one the reader may not convert", () => {
    mocks.measurementSystem = "metric";
    expect(renderOn(() => useAutoConversion()).page().conversion).toBeNull();

    mocks.measurementSystem = "us";
    mocks.canEdit = false;
    expect(renderOn(() => useAutoConversion()).page().conversion).toBeNull();
  });
});

describe("useSystemConversion", () => {
  it("offers the written system, the other one, and with AI the other one again", () => {
    mocks.isAIEnabled = true;

    const { result } = renderOn(() => useSystemConversion());

    expect(result.current.isAvailable).toBe(true);
    expect(result.current.currentSystem).toBe("metric");
    expect(result.current.options.map((option) => [option.key, option.labelKey])).toEqual([
      ["metric", "toMetric"],
      ["us", "toUS"],
      ["us-ai", "toUSWithAI"],
    ]);
    expect(result.current.options[0]).toMatchObject({ isOriginal: true });
  });

  it("offers no AI option where AI is off, and nothing for a recipe without lines", () => {
    expect(renderOn(() => useSystemConversion()).result.current.options).toHaveLength(2);
    expect(renderOn(() => useSystemConversion(), metricRecipe([])).result.current.isAvailable).toBe(
      false
    );
  });

  it("is hidden with the Hidden Item, and converting to the system shown does nothing", () => {
    mocks.showConversion = false;
    expect(renderOn(() => useSystemConversion()).result.current.isAvailable).toBe(false);

    mocks.showConversion = true;
    const { result, page } = renderOn(() => useSystemConversion());

    act(() => result.current.convertTo(result.current.options[0]!));
    expect(page().conversion).toBeNull();

    act(() => result.current.convertTo(result.current.options[1]!));
    expect(page().conversion).toMatchObject({ target: "us", withAI: false });
  });
});
