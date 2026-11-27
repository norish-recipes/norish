import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useConvertMutation } from "../use-convert-mutation";

const sendConvert = vi.hoisted(() => vi.fn());

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    recipes: {
      get: { queryKey: (input: unknown) => [["recipes", "get"], { input }] },
      convertMeasurements: {
        mutationOptions: (options?: object) => ({ ...options, mutationFn: sendConvert }),
      },
    },
  }),
}));

describe("useConvertMutation", () => {
  beforeEach(() => sendConvert.mockReset());

  it("reports each of two overlapping conversions that fail", async () => {
    const queryClient = createTestQueryClient();
    const answers = [Promise.withResolvers<never>(), Promise.withResolvers<never>()];

    sendConvert
      .mockImplementationOnce(() => answers[0]!.promise)
      .mockImplementationOnce(() => answers[1]!.promise);

    const onError = vi.fn();
    const { result } = renderHook(() => useConvertMutation("recipe-1", { onError }), {
      wrapper: createTestWrapper(queryClient),
    });

    act(() => void result.current.convertMeasurements({ target: "us", withAI: false, version: 1 }));
    act(
      () => void result.current.convertMeasurements({ target: "metric", withAI: false, version: 1 })
    );
    await act(async () => answers[0]!.reject(new Error("Conversion failed")));
    await act(async () => answers[1]!.reject(new Error("Conversion failed")));
    await act(async () => {
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    });

    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("rereads instead of restoring its snapshot over a newer recipe when it fails", async () => {
    const queryClient = createTestQueryClient();
    const key = [["recipes", "get"], { input: { id: "recipe-1" } }];
    const recipe = {
      id: "recipe-1",
      name: "Soup",
      version: 1,
      systemUsed: "metric",
      recipeIngredients: [{ systemUsed: "metric" }, { systemUsed: "us" }],
      steps: [],
    };
    const answer = Promise.withResolvers<never>();

    sendConvert.mockImplementationOnce(() => answer.promise);
    queryClient.setQueryData(key, recipe);
    const { result } = renderHook(() => useConvertMutation("recipe-1"), {
      wrapper: createTestWrapper(queryClient),
    });

    act(() => void result.current.convertMeasurements({ target: "us", withAI: false, version: 1 }));
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(key)).toMatchObject({ systemUsed: "us" })
    );
    const edited = { ...recipe, name: "Stew", version: 2, systemUsed: "us" };

    act(() => queryClient.setQueryData(key, edited));
    await act(async () => answer.reject(new Error("Conversion failed")));

    expect(queryClient.getQueryData(key)).toEqual(edited);
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it("leaves an older recipe an earlier failed edit restored, rather than copy its system onto it", async () => {
    const queryClient = createTestQueryClient();
    const key = [["recipes", "get"], { input: { id: "recipe-1" } }];
    const recipe = {
      id: "recipe-1",
      name: "Soup",
      version: 5,
      systemUsed: "metric",
      recipeIngredients: [{ systemUsed: "metric" }, { systemUsed: "us" }],
      steps: [],
    };
    const answer = Promise.withResolvers<never>();

    sendConvert.mockImplementationOnce(() => answer.promise);
    queryClient.setQueryData(key, recipe);
    const { result } = renderHook(() => useConvertMutation("recipe-1"), {
      wrapper: createTestWrapper(queryClient),
    });

    act(() => void result.current.convertMeasurements({ target: "us", withAI: false, version: 5 }));
    await vi.waitFor(() =>
      expect(queryClient.getQueryData(key)).toMatchObject({ systemUsed: "us" })
    );
    const restored = { ...recipe, name: "Broth", version: 4, systemUsed: "us" };

    act(() => queryClient.setQueryData(key, restored));
    await act(async () => answer.reject(new Error("Conversion failed")));

    expect(queryClient.getQueryData(key)).toEqual(restored);
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  });
});
