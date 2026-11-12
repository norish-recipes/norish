import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { answerCall, keyOf, resetTRPCFake, sentCall } from "../../trpc/testing";
import { useCuisineWrites } from "../use-cuisine-writes";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const CUISINES = keyOf("config.cuisines");

function setUp() {
  const queryClient = createTestQueryClient();

  queryClient.setQueryData(CUISINES, []);

  return {
    stale: () => queryClient.getQueryState(CUISINES)?.isInvalidated,
    wrapper: createTestWrapper(queryClient, fakePlatformAdapter()),
  };
}

afterEach(resetTRPCFake);

describe("useCuisineWrites", () => {
  it("reads the vocabulary again once a cuisine is added", async () => {
    const { stale, wrapper } = setUp();
    const { result } = renderHook(() => useCuisineWrites(), { wrapper });
    let added: Promise<unknown> | undefined;

    act(() => {
      added = result.current.create("Thai");
    });
    await answerCall("admin.cuisines.create", { id: "c1" });

    expect(await added).toBeNull();
    expect(stale()).toBe(true);
  });

  it("tells a taken name from any other failure", async () => {
    const { stale, wrapper } = setUp();
    const { result } = renderHook(() => useCuisineWrites(), { wrapper });
    let renamed: Promise<unknown> | undefined;
    let removed: Promise<unknown> | undefined;

    act(() => {
      renamed = result.current.rename("c1", "Thai");
      removed = result.current.remove("c2");
    });
    const rename = await sentCall("admin.cuisines.rename");
    const remove = await sentCall("admin.cuisines.delete");

    await act(async () => {
      rename.deferred.reject(Object.assign(new Error("taken"), { data: { code: "CONFLICT" } }));
      remove.deferred.reject(new Error("offline"));
    });

    expect(await renamed).toBe("duplicate");
    expect(await removed).toBe("saveFailed");
    expect(stale()).toBe(false);
  });
});
