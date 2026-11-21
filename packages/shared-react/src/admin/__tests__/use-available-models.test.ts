import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useAvailableModelsQuery } from "../use-available-models";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

afterEach(resetTRPCFake);

describe("useAvailableModelsQuery", () => {
  it("asks nothing until the form names a provider it can reach, then lists its models", async () => {
    const asked = vi.fn();

    serveTRPC(async (path, input) => {
      asked(path, input);

      return { models: [{ id: "gpt-x" }] };
    });
    const wrapper = createTestWrapper(createTestQueryClient(), fakePlatformAdapter());
    const { result, rerender } = renderHook(
      ({ ready }: { ready: boolean }) =>
        useAvailableModelsQuery(ready ? { provider: "openai", apiKey: "sk" } : null),
      { wrapper, initialProps: { ready: false } }
    );

    expect(result.current).toMatchObject({ models: [], isLoading: false });
    expect(asked).not.toHaveBeenCalled();

    rerender({ ready: true });
    await waitFor(() => expect(result.current.models).toEqual([{ id: "gpt-x" }]));
    expect(asked).toHaveBeenCalledWith("admin.listAvailableModels", {
      provider: "openai",
      apiKey: "sk",
    });
  });
});
