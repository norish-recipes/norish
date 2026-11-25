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
  it("reads the list again once an instance Cuisine is added", async () => {
    const { stale, wrapper } = setUp();
    const onRefused = vi.fn();
    const { result } = renderHook(() => useCuisineMutations(onRefused), { wrapper });
    let added: Promise<boolean> | undefined;

    act(() => {
      added = result.current.create("Thai");
    });
    expect((await sentCall("lists.add")).input).toEqual({
      kind: "cuisine",
      name: "Thai",
      instance: true,
    });
    await answerCall("lists.add", { created: true, entry: { id: "c1" } });

    expect(await added).toBe(true);
    expect(onRefused).not.toHaveBeenCalled();
    expect(stale()).toBe(true);
  });

  it("calls a name already in the list a duplicate", async () => {
    const { wrapper } = setUp();
    const onRefused = vi.fn();
    const { result } = renderHook(() => useCuisineMutations(onRefused), { wrapper });
    let added: Promise<boolean> | undefined;

    act(() => {
      added = result.current.create("thai");
    });
    await answerCall("lists.add", { created: false, entry: { id: "c1" } });

    expect(await added).toBe(false);
    expect(onRefused.mock.calls).toEqual([["duplicate"]]);
  });

  it("says a failed rename or delete was not saved", async () => {
    const { stale, wrapper } = setUp();
    const onRefused = vi.fn();
    const { result } = renderHook(() => useCuisineMutations(onRefused), { wrapper });
    let renamed: Promise<boolean> | undefined;
    let removed: Promise<boolean> | undefined;

    act(() => {
      renamed = result.current.rename("c1", "Thai");
      removed = result.current.remove("c2");
    });
    const rename = await sentCall("lists.rename");
    const remove = await sentCall("lists.delete");

    await act(async () => {
      rename.deferred.reject(new Error("gone"));
      remove.deferred.reject(new Error("offline"));
    });

    expect([await renamed, await removed]).toEqual([false, false]);
    expect(onRefused.mock.calls).toEqual([["saveFailed"], ["saveFailed"]]);
    expect(stale()).toBe(false);
  });
});
