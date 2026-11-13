import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import type { InfiniteRecipeData } from "../library-cache";
import { useRecipesMutations } from "../use-recipes-mutations";

const server = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../trpc", () => {
  const key =
    (...path: string[]) =>
    (input?: unknown) => [path, ...(input === undefined ? [] : [{ input }])];
  const procedure = (mutationFn: (input: unknown) => unknown) => ({
    mutationOptions: (options?: object) => ({ ...options, mutationFn }),
  });

  return {
    useTRPC: () => ({
      recipes: {
        list: { queryKey: key("recipes", "list"), pathKey: key("recipes", "list") },
        get: { queryKey: key("recipes", "get") },
        getPending: { queryKey: key("recipes", "getPending") },
        create: procedure(server.create),
        update: procedure(server.update),
        delete: procedure(vi.fn()),
        convertMeasurements: procedure(vi.fn()),
      },
      library: { list: { queryKey: key("library", "list"), pathKey: key("library", "list") } },
      cookbooks: { recipes: { pathKey: key("cookbooks", "recipes") } },
    }),
  };
});

const LIST_KEY = [["recipes", "list"], { input: {} }];
const detailKey = (id: string) => [["recipes", "get"], { input: { id } }];
const EMPTY_LIST: InfiniteRecipeData = {
  pages: [{ recipes: [], total: 0, nextCursor: null }],
  pageParams: [0],
};

function recipe(id: string, name: string) {
  return { id, name, systemUsed: "metric" as const, recipeIngredients: [], steps: [], tags: [] };
}

describe("useRecipesMutations", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    for (const send of Object.values(server)) send.mockReset();
    queryClient = createTestQueryClient();
    queryClient.setQueryData(LIST_KEY, EMPTY_LIST);
  });

  afterEach(() => vi.unstubAllGlobals());

  const render = (...args: Parameters<typeof useRecipesMutations>) =>
    renderHook(() => useRecipesMutations(...args), { wrapper: createTestWrapper(queryClient) })
      .result;
  const settled = () =>
    act(async () => {
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    });
  const firstCard = () =>
    queryClient.getQueryData<InfiniteRecipeData>(LIST_KEY)?.pages[0]?.recipes[0];

  it("rolls back two overlapping creates that fail, lists and details as they were", async () => {
    const answers = [Promise.withResolvers<never>(), Promise.withResolvers<never>()];
    const soup = recipe("11111111-1111-4111-8111-111111111111", "Soup");
    const stew = recipe("22222222-2222-4222-8222-222222222222", "Stew");

    server.create
      .mockImplementationOnce(() => answers[0]!.promise)
      .mockImplementationOnce(() => answers[1]!.promise);
    const result = render();

    act(() => result.current.createRecipe(soup));
    act(() => result.current.createRecipe(stew));
    await act(async () => {
      await vi.waitFor(() =>
        expect(queryClient.getQueryData<InfiniteRecipeData>(LIST_KEY)?.pages[0]?.total).toBe(2)
      );
    });
    await act(async () => answers[0]!.reject(new Error("Bad recipe")));
    await act(async () => answers[1]!.reject(new Error("Bad recipe")));
    await settled();

    expect(queryClient.getQueryData(LIST_KEY)).toEqual(EMPTY_LIST);
    expect(queryClient.getQueryData(detailKey(soup.id))).toBeUndefined();
    expect(queryClient.getQueryData(detailKey(stew.id))).toBeUndefined();
  });

  describe("createRecipe", () => {
    it("shows the new recipe's page and card at once, before the server answers", async () => {
      const id = "11111111-1111-4111-8111-111111111111";

      server.create.mockReturnValue(new Promise(() => {}));
      const result = render();

      act(() =>
        result.current.createRecipe({
          id,
          name: "Metric recipe",
          systemUsed: "metric",
          recipeIngredients: [{ ingredientName: "chickpeas", amount: 400, unit: "gram", order: 0 }],
          steps: [{ step: "Mix", systemUsed: "metric", order: 0 }],
          tags: [{ name: "dinner" }],
        })
      );
      await act(async () => {
        await vi.waitFor(() => expect(queryClient.getQueryData(detailKey(id))).toBeDefined());
      });

      const detail = queryClient.getQueryData<FullRecipeDTO>(detailKey(id));

      expect(detail).toMatchObject({ id, name: "Metric recipe", systemUsed: "metric" });
      expect(detail?.recipeIngredients[0]).toMatchObject({
        ingredientName: "chickpeas",
        amount: 400,
        unit: "gram",
        systemUsed: "metric",
      });
      expect(firstCard()).toMatchObject({ id, name: "Metric recipe" });
      expect(server.create).toHaveBeenCalledWith(
        expect.objectContaining({ id, name: "Metric recipe" }),
        expect.anything()
      );
    });

    it("gives the new card the gallery's first image", async () => {
      server.create.mockReturnValue(new Promise(() => {}));
      const result = render();

      act(() =>
        result.current.createRecipe({
          ...recipe("22222222-2222-4222-8222-222222222222", "Gallery recipe"),
          images: [
            { image: "/recipes/22222222/second.jpg", order: 1 },
            { image: "/recipes/22222222/first.jpg", order: 0 },
          ],
        })
      );
      await act(async () => {
        await vi.waitFor(() => expect(firstCard()).toBeDefined());
      });

      expect(firstCard()).toMatchObject({ image: "/recipes/22222222/first.jpg" });
    });

    it("mints uuids for the new rows where crypto.randomUUID is missing", async () => {
      const id = "33333333-3333-4333-8333-333333333333";

      server.create.mockReturnValue(new Promise(() => {}));
      vi.stubGlobal("crypto", {
        getRandomValues: (bytes: Uint8Array) => bytes.map((_, index) => index + 1),
      });
      const result = render();

      act(() =>
        result.current.createRecipe({
          ...recipe(id, "LAN recipe"),
          recipeIngredients: [{ ingredientName: "lentils", order: 0 }],
        })
      );
      await act(async () => {
        await vi.waitFor(() => expect(queryClient.getQueryData(detailKey(id))).toBeDefined());
      });

      expect(
        queryClient.getQueryData<FullRecipeDTO>(detailKey(id))?.recipeIngredients[0]?.id
      ).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe("updateRecipe", () => {
    const detail: FullRecipeDTO = {
      id: "recipe-1",
      userId: "user-1",
      name: "Original recipe",
      description: null,
      notes: null,
      url: null,
      originCountry: null,
      originCountryName: null,
      originRegion: null,
      provenanceNote: null,
      cuisines: [],
      originalSystem: null,
      dishColor: null,
      servings: 1,
      prepMinutes: null,
      cookMinutes: null,
      totalMinutes: null,
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
      systemUsed: "us",
      createdAt: new Date(0),
      updatedAt: new Date(0),
      recipeIngredients: [],
      steps: [],
      tags: [],
      categories: [],
      author: { id: "user-1", name: "User", image: null, version: 1 },
      images: [],
      videos: [],
      version: 1,
    };

    async function update(seed: Partial<FullRecipeDTO>, input: Record<string, unknown>) {
      queryClient.setQueryData<FullRecipeDTO>(detailKey("recipe-1"), { ...detail, ...seed });
      server.update.mockReturnValue(new Promise(() => {}));
      const result = render();

      act(() => result.current.updateRecipe("recipe-1", input));
      await act(async () => {
        await vi.waitFor(() => expect(server.update).toHaveBeenCalled());
      });

      return queryClient.getQueryData<FullRecipeDTO>(detailKey("recipe-1"));
    }

    it("shows a changed measurement system at once", async () => {
      expect(await update({}, { systemUsed: "metric" })).toMatchObject({ systemUsed: "metric" });
    });

    it("keeps the detail whole when an edit adds rows and changes cuisines and tags", async () => {
      const italian = { id: "11111111-1111-4111-8111-111111111111", name: "Italian", version: 1 };
      const updated = await update(
        { cuisines: [italian], tags: [{ name: "pasta", version: 3 }] },
        {
          recipeIngredients: [{ ingredientName: "Basil", amount: "2", order: 0 }],
          cuisines: [],
          tags: [{ name: "pasta" }, { name: "quick" }],
        }
      );

      expect(updated?.recipeIngredients).toEqual([
        expect.objectContaining({ id: expect.any(String), ingredientName: "Basil", amount: 2 }),
      ]);
      expect(updated?.cuisines).toEqual([]);
      expect(updated?.tags).toEqual([
        { name: "pasta", version: 3 },
        { name: "quick", version: 1 },
      ]);
    });
  });
});
