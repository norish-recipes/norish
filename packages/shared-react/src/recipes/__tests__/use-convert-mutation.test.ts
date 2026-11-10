import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "../../groceries/__tests__/test-utils";
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

    act(() => result.current.convertMeasurements("us", 1));
    act(() => result.current.convertMeasurements("metric", 1));
    await act(async () => answers[0]!.reject(new Error("Conversion failed")));
    await act(async () => answers[1]!.reject(new Error("Conversion failed")));
    await act(async () => {
      await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    });

    expect(onError).toHaveBeenCalledTimes(2);
  });
});
