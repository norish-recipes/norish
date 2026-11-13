import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { answerCall, keyOf, resetTRPCFake, sentCall } from "../../trpc/testing";
import { useCuisineMutations } from "../use-cuisine-mutations";

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

describe("useCuisineMutations", () => {
  it("reads the vocabulary again once a cuisine is added", async () => {
    const { stale, wrapper } = setUp();
    const onRefused = vi.fn();
    const { result } = renderHook(() => useCuisineMutations(onRefused), { wrapper });
    let added: Promise<boolean> | undefined;

    act(() => {
      added = result.current.create("Thai");
    });
    await answerCall("admin.cuisines.create", { id: "c1" });

    expect(await added).toBe(true);
    expect(onRefused).not.toHaveBeenCalled();
    expect(stale()).toBe(true);
  });

  it("tells a taken name from any other failure", async () => {
    const { stale, wrapper } = setUp();
    const onRefused = vi.fn();
    const { result } = renderHook(() => useCuisineMutations(onRefused), { wrapper });
    let renamed: Promise<boolean> | undefined;
    let removed: Promise<boolean> | undefined;

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

    expect([await renamed, await removed]).toEqual([false, false]);
    expect(onRefused.mock.calls).toEqual([["duplicate"], ["saveFailed"]]);
    expect(stale()).toBe(false);
  });
});
