import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import type { AIChange, IngredientItem } from "../types";
import { answerCall, keyOf, resetTRPCFake, sentCall } from "../../trpc/testing";
import { useAIChangeMutations, useAIChangesQuery } from "../use-ai-changes";
import { useIngredientMutations } from "../use-ingredient-mutations";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const onion: IngredientItem = {
  id: "onion",
  name: "onion",
  flagged: true,
  flagReason: "ai-unsure",
  parent: null,
  kinds: 0,
  canEdit: true,
  aliases: [{ id: "a-onion", text: "onion", canRemove: true }],
};
const salt: IngredientItem = { ...onion, id: "salt", name: "salt", flagged: false };

const LIST = [["ingredients", "list"], { input: { locale: "en" }, type: "infinite" }];
const KINDS = [["ingredients", "kinds"], { input: { parentId: "veg" }, type: "query" }];
const AI_CHANGES = keyOf("ingredients.aiChanges");

function setUp() {
  const queryClient = createTestQueryClient();
  const platform = fakePlatformAdapter();

  queryClient.setQueryData(LIST, { pages: [{ items: [onion, salt], nextCursor: null }] });
  queryClient.setQueryData(KINDS, [onion]);

  const listed = () =>
    queryClient.getQueryData<{ pages: { items: IngredientItem[] }[] }>(LIST)?.pages[0]?.items ?? [];
  const stale = () => queryClient.getQueryState(LIST)?.isInvalidated;

  return {
    queryClient,
    platform,
    listed,
    stale,
    wrapper: createTestWrapper(queryClient, platform),
  };
}

afterEach(resetTRPCFake);

describe("useIngredientMutations", () => {
  it("takes a deleted food off every list at once, and reads the lists again once it went through", async () => {
    const { listed, stale, queryClient, wrapper } = setUp();
    const { result } = renderHook(() => useIngredientMutations(), { wrapper });
    let went: Promise<boolean> | undefined;

    act(() => {
      went = result.current.remove("onion");
    });

    await sentCall("ingredients.remove");
    expect(listed().map((item) => item.id)).toEqual(["salt"]);
    expect(queryClient.getQueryData(KINDS)).toEqual([]);
    expect(stale()).toBe(false);

    await answerCall("ingredients.remove", { success: true });
    expect(await went).toBe(true);
    expect(stale()).toBe(true);
  });

  it("says why a refused edit was refused, and reads everything again", async () => {
    const { platform, stale, wrapper } = setUp();
    const { result } = renderHook(() => useIngredientMutations(), { wrapper });
    let went: Promise<boolean> | undefined;

    act(() => {
      went = result.current.markDistinct("onion");
    });
    const call = await sentCall("ingredients.markDistinct");

    await act(async () => call.deferred.reject(new Error("forbidden")));

    expect(await went).toBe(false);
    expect(stale()).toBe(true);
    expect(platform.toast.show).toHaveBeenCalledWith({
      severity: "danger",
      title: "settings.ingredients.errors.title",
      description: "settings.ingredients.errors.forbidden",
    });
  });

  it("shows a saved draft in the row, its parent named and its flag settled, and sends only ids", async () => {
    const { listed, wrapper } = setUp();
    const { result } = renderHook(() => useIngredientMutations(), { wrapper });

    act(() => {
      void result.current.saveDraft({
        ingredientId: "onion",
        name: "Onion",
        parent: { id: "veg", name: "vegetable" },
        add: ["ui"],
        remove: ["a-onion"],
        junk: [],
        icon: { file: "f1", address: "/ingredient-icons/f1.webp" },
      });
    });

    expect((await sentCall("ingredients.saveDraft")).input).toEqual({
      ingredientId: "onion",
      name: "Onion",
      parentId: "veg",
      add: ["ui"],
      remove: ["a-onion"],
      junk: [],
      icon: "f1",
    });
    expect(listed()[0]).toMatchObject({
      name: "Onion",
      parent: { id: "veg", name: "vegetable" },
      flagged: false,
      icon: "/ingredient-icons/f1.webp",
      ownIcon: true,
      aliases: [{ id: "draft:ui", text: "ui", canRemove: true }],
    });
  });
});

describe("useAIChangeMutations", () => {
  const change: AIChange = {
    id: "c1",
    kind: "merge",
    sure: false,
    kept: false,
    createdAt: new Date(0),
    ingredient: { id: "onion", name: "onion", localeNames: {} },
    target: null,
    dropped: null,
    from: "uitjes",
    canAct: true,
  };

  it("keeps a change at once, and reads every Ingredient again once answered", async () => {
    const { queryClient, stale, wrapper } = setUp();

    queryClient.setQueryData(AI_CHANGES, [change]);
    const { result } = renderHook(() => useAIChangeMutations(), { wrapper });

    act(() => {
      void result.current.keep(change);
    });
    await sentCall("ingredients.keepAIChange");
    expect(queryClient.getQueryData<AIChange[]>(AI_CHANGES)?.[0]?.kept).toBe(true);

    await answerCall("ingredients.keepAIChange", { success: true });
    expect(stale()).toBe(true);
  });
});

describe("useAIChangesQuery", () => {
  it("hands each reader only its slice", () => {
    const { queryClient, wrapper } = setUp();
    const open: AIChange = {
      id: "c1",
      kind: "merge",
      sure: false,
      kept: false,
      createdAt: new Date(0),
      ingredient: { id: "onion", name: "onion", localeNames: {} },
      target: null,
      dropped: null,
      from: "uitjes",
      canAct: true,
    };

    queryClient.setQueryData(AI_CHANGES, [open, { ...open, id: "c2", kept: true }]);
    const { result } = renderHook(() => useAIChangesQuery((changes) => changes.length), {
      wrapper,
    });

    expect(result.current).toBe(2);
  });

  it("selects from no changes until the read answers", () => {
    const { wrapper } = setUp();
    const { result } = renderHook(() => useAIChangesQuery((changes) => changes.length), {
      wrapper,
    });

    expect(result.current).toBe(0);
  });
});
