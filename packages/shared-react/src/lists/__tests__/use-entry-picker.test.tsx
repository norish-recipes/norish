import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { MUTATION_SEND_TIMEOUT_MS } from "../../offline/outbox-link";
import { ConnectivityProvider } from "../../offline/react";
import {
  answerCall,
  answerRead,
  failCall,
  failRead,
  keyOf,
  resetTRPCFake,
  sentCall,
  serveTRPC,
  trpcCalls,
} from "../../trpc/testing";
import { isUncaptured } from "../../offline/uncaptured";
import { useEntryCreatePending, useEntryPicker } from "../use-entry-picker";

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

/** Answers the list read with `entries` and waits for the picker to show it. */
const readList = (result: { current: { offer: { kind: string } } }, entries: unknown[] = []) =>
  waitFor(() => {
    answerRead("lists.list", entries);
    expect(result.current.offer.kind).not.toBe("none");
  });

afterEach(() => {
  vi.useRealTimers();
  resetTRPCFake();
});

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

    await waitFor(() => expect(cafe.result.current.matches).toHaveLength(0));
    await waitFor(() => expect(cafe.result.current.offer).toEqual({ kind: "none" }));
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

    await readList(result);
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

    await waitFor(() => expect(result.current.matches).toHaveLength(1));
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

    await readList(result);
    act(() => void result.current.createAndSelect());
    await failCall("lists.add");

    await waitFor(() =>
      expect(result.current.problem).toEqual({ key: "createFailed", values: { name: "Grill" } })
    );
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

    await readList(result);
    expect(result.current.offer).toEqual({ kind: "create", name: "Grill" });
    expect(result.current.createDisabled).toBe(true);
    await act(async () => result.current.createAndSelect());
    expect(trpcCalls["lists.add"]).toBeUndefined();
  });

  describe("while the list is unread or unreadable", () => {
    const hold = (typed: string) => {
      resetTRPCFake();

      return renderHook(
        () => useEntryPicker({ kind: "tag", typed, isSelected: () => false, onSelect: vi.fn() }),
        { wrapper: createTestWrapper(createTestQueryClient(), fakePlatformAdapter()) }
      );
    };

    it("offers no Create row until the list has loaded, then none for a name it has", async () => {
      const { result } = hold("BBQ");

      expect(result.current.offer).toEqual({ kind: "none" });
      answerRead("lists.list", [entry("1", "BBQ")]);
      await waitFor(() => expect(result.current.matches).toHaveLength(1));
      expect(result.current.offer).toEqual({ kind: "none" });
    });

    it("says the list failed to load, and reads it again on retry", async () => {
      const { result } = hold("Grill");

      failRead("lists.list");
      await waitFor(() =>
        expect(result.current.problem).toEqual({ key: "loadFailed", values: {} })
      );
      expect(result.current.offer).toEqual({ kind: "none" });

      act(() => result.current.retryList());
      answerRead("lists.list", []);
      await waitFor(() => expect(result.current.problem).toBeNull());
      expect(result.current.offer).toEqual({ kind: "create", name: "Grill" });
    });
  });

  it("selects into what the form holds when the create answers, not when it began", async () => {
    resetTRPCFake();
    const first = vi.fn();
    const second = vi.fn();
    const wrapper = createTestWrapper(createTestQueryClient(), fakePlatformAdapter());
    const { result, rerender } = renderHook(
      ({ onSelect }) =>
        useEntryPicker({ kind: "tag", typed: "Grill", isSelected: () => false, onSelect }),
      { wrapper, initialProps: { onSelect: first } }
    );

    await readList(result);
    act(() => void result.current.createAndSelect());
    rerender({ onSelect: second });
    await answerCall("lists.add", { created: true, entry: entry("9", "Grill") });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(entry("9", "Grill"));
  });

  it("keeps a failed create said when the text changes, until the reader picks or tries again", async () => {
    resetTRPCFake();
    const wrapper = createTestWrapper(createTestQueryClient(), fakePlatformAdapter());
    const onSelect = vi.fn();
    const { result, rerender } = renderHook(
      ({ typed }) => useEntryPicker({ kind: "tag", typed, isSelected: () => false, onSelect }),
      { wrapper, initialProps: { typed: "Grill" } }
    );

    await readList(result);
    act(() => void result.current.createAndSelect());
    await failCall("lists.add");
    await waitFor(() => expect(result.current.problem?.key).toBe("createFailed"));

    rerender({ typed: "Smoke" });
    expect(result.current.problem).toEqual({ key: "createFailed", values: { name: "Grill" } });

    act(() => result.current.pick(entry("1", "BBQ")));
    expect(result.current.problem).toBeNull();
  });

  it("knows a create is under way, so a save can wait for it", async () => {
    resetTRPCFake();
    const wrapper = createTestWrapper(createTestQueryClient(), fakePlatformAdapter());
    const { result } = renderHook(
      () => ({
        picker: useEntryPicker({
          kind: "tag",
          typed: "Grill",
          isSelected: () => false,
          onSelect: vi.fn(),
        }),
        pending: useEntryCreatePending(),
      }),
      { wrapper }
    );

    await waitFor(() => {
      answerRead("lists.list", []);
      expect(result.current.picker.offer.kind).toBe("create");
    });
    expect(result.current.pending).toBe(false);
    act(() => void result.current.picker.createAndSelect());
    await waitFor(() => expect(result.current.pending).toBe(true));
    await answerCall("lists.add", { created: true, entry: entry("9", "Grill") });
    await waitFor(() => expect(result.current.pending).toBe(false));
  });

  describe("a create that does not answer", () => {
    const start = async (queryClient = createTestQueryClient()) => {
      resetTRPCFake();
      const onSelect = vi.fn();
      const wrapper = createTestWrapper(queryClient, fakePlatformAdapter());
      const picker = renderHook(
        () => useEntryPicker({ kind: "tag", typed: "Grill", isSelected: () => false, onSelect }),
        { wrapper }
      );
      const pending = renderHook(() => useEntryCreatePending(), { wrapper });

      await readList(picker.result);
      act(() => void picker.result.current.createAndSelect());
      await waitFor(() => expect(pending.result.current).toBe(true));

      return { picker, pending, onSelect, queryClient };
    };

    it("stops holding a save when the picker that started it goes", async () => {
      const { picker, pending } = await start();

      picker.unmount();
      await waitFor(() => expect(pending.result.current).toBe(false));
    });

    it("times out with the create-failed message, and a late answer selects nothing", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { picker, pending, onSelect } = await start();

      await act(() => vi.advanceTimersByTimeAsync(MUTATION_SEND_TIMEOUT_MS));
      await waitFor(() => expect(pending.result.current).toBe(false));
      expect(picker.result.current.problem).toEqual({
        key: "createFailed",
        values: { name: "Grill" },
      });
      await answerCall("lists.add", { created: true, entry: entry("9", "Grill") });
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("is never queued in the Outbox: a network rejection fails at once", () => {
      expect(isUncaptured("lists.add")).toBe(true);
    });
  });

  it("drops the answer of a create whose picker has gone, leaving the entry in the list", async () => {
    resetTRPCFake();
    const queryClient = createTestQueryClient();
    const onSelect = vi.fn();
    const wrapper = createTestWrapper(queryClient, fakePlatformAdapter());
    const { result, unmount } = renderHook(
      () => useEntryPicker({ kind: "tag", typed: "Grill", isSelected: () => false, onSelect }),
      { wrapper }
    );

    await readList(result);
    act(() => void result.current.createAndSelect());
    unmount();
    await answerCall("lists.add", { created: true, entry: entry("9", "Grill") });

    expect(onSelect).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(keyOf("lists.list", { kind: "tag" }))).toEqual([
      entry("9", "Grill"),
    ]);
  });
});
