import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { ConnectivityProvider } from "../../offline/react";
import {
  answerCall,
  failCall,
  resetTRPCFake,
  sentCall,
  serveTRPC,
  trpcCalls,
} from "../../trpc/testing";
import { useEntryPicker } from "../use-entry-picker";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const entry = (id: string, name: string) => ({ id, name, instance: false });

function setUp(typed: string, recipeId?: string) {
  const reads: unknown[] = [];

  serveTRPC(async (path, input) => {
    if (path === "lists.list") {
      reads.push(input);

      return [entry("1", "BBQ"), entry("2", "Café")];
    }

    return { stale: false };
  });

  const onSelect = vi.fn();
  const wrapper = createTestWrapper(createTestQueryClient(), fakePlatformAdapter());
  const hook = renderHook(
    () =>
      useEntryPicker({
        kind: "tag",
        recipeId,
        typed,
        isSelected: (picked) => picked.id === "2",
        onSelect,
      }),
    { wrapper }
  );

  return { ...hook, reads, onSelect };
}

afterEach(resetTRPCFake);

describe("useEntryPicker", () => {
  it("matches typed text on the fold and leaves out what is selected", async () => {
    const { result } = setUp("b");

    await waitFor(() => expect(result.current.matches.map((e) => e.name)).toEqual(["BBQ"]));
    expect(result.current.offer).toEqual({ kind: "create", name: "b" });
  });

  it("offers no Create row for a different case of an entry, even a selected one", async () => {
    const bbq = setUp("bbq");

    await waitFor(() => expect(bbq.result.current.matches).toHaveLength(1));
    expect(bbq.result.current.offer).toEqual({ kind: "none" });

    const cafe = setUp("cafe");

    await waitFor(() => expect(cafe.result.current.isLoading).toBe(false));
    expect(cafe.result.current.offer).toEqual({ kind: "none" });
  });

  it("reads the recipe's household's list when it is editing a recipe", async () => {
    const { reads, result } = setUp("", "55555555-5555-4555-8555-555555555555");

    await waitFor(() => expect(result.current.matches).toHaveLength(1));
    expect(reads).toEqual([{ kind: "tag", recipeId: "55555555-5555-4555-8555-555555555555" }]);
  });

  it("creates through lists.add, then selects the entry it answers, once however often it is asked", async () => {
    resetTRPCFake();
    const onSelect = vi.fn();
    const wrapper = createTestWrapper(createTestQueryClient(), fakePlatformAdapter());
    const { result } = renderHook(
      () => useEntryPicker({ kind: "tag", typed: "Grill", isSelected: () => false, onSelect }),
      { wrapper }
    );

    await act(async () => {
      void result.current.createAndSelect();
      void result.current.createAndSelect();
    });
    expect(trpcCalls["lists.add"]).toHaveLength(1);
    expect((await sentCall("lists.add")).input).toEqual({
      kind: "tag",
      name: "Grill",
      recipeId: undefined,
    });
    expect(onSelect).not.toHaveBeenCalled();

    await answerCall("lists.add", { created: true, entry: entry("9", "Grill") });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(entry("9", "Grill"));
  });

  it("creates nothing for a name the list has", async () => {
    const { result } = setUp("bbq");

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => result.current.createAndSelect());
    expect(trpcCalls["lists.add"]).toBeUndefined();
  });

  it("selects nothing when the create fails, and offers the name again", async () => {
    resetTRPCFake();
    const onSelect = vi.fn();
    const wrapper = createTestWrapper(createTestQueryClient(), fakePlatformAdapter());
    const { result } = renderHook(
      () => useEntryPicker({ kind: "tag", typed: "Grill", isSelected: () => false, onSelect }),
      { wrapper }
    );

    act(() => void result.current.createAndSelect());
    await failCall("lists.add");

    await waitFor(() => expect(result.current.createFailed).toBe(true));
    expect(onSelect).not.toHaveBeenCalled();
    expect(result.current.offer).toEqual({ kind: "create", name: "Grill" });
  });

  it("does not create offline: the row is offered but disabled", async () => {
    resetTRPCFake();
    const queryClient = createTestQueryClient();
    const base = createTestWrapper(queryClient, fakePlatformAdapter());
    const wrapper = ({ children }: { children: ReactNode }) =>
      base({
        children: (
          <ConnectivityProvider
            forced
            probe={async () => false}
            subscribeHints={() => () => {}}
            wsStatus="disconnected"
          >
            {children}
          </ConnectivityProvider>
        ),
      });
    const { result } = renderHook(
      () =>
        useEntryPicker({ kind: "tag", typed: "Grill", isSelected: () => false, onSelect: vi.fn() }),
      { wrapper }
    );

    expect(result.current.offer).toEqual({ kind: "create", name: "Grill" });
    expect(result.current.createDisabled).toBe(true);
    await act(async () => result.current.createAndSelect());
    expect(trpcCalls["lists.add"]).toBeUndefined();
  });
});
