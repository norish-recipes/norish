/**
 * Keeping a Bring Handoff ready while the reader picks lines: when it is prepared and changed,
 * how the press opens it, what each failure says, and when it is taken down.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import type { BringContext, BringLine } from "../use-bring-handoff";
import {
  answerCall,
  failCall,
  resetTRPCFake,
  sentCall,
  serveTRPC,
  trpcCalls,
} from "../../trpc/testing";
import { useBringHandoff } from "../use-bring-handoff";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

afterEach(() => {
  resetTRPCFake();
  vi.useRealTimers();
});

const TOKEN = "T".repeat(32);
const DEEPLINK = "https://getbring.onelink.me/abc";
const ITEMS = [{ name: "flour", amount: 200, unit: "g" }];
const PREPARED = { ok: true, token: TOKEN, deeplink: DEEPLINK };

type Props = { enabled: boolean; items: BringLine[]; context: BringContext };

/** `opens` is whether the platform lets the link open, as a browser that did not block the tab. */
function setup(initial: Partial<Props> = {}, opens = true) {
  const adapter = { ...fakePlatformAdapter(), openExternalUrl: vi.fn(() => opens) };
  const view = renderHook((props: Props) => useBringHandoff(props), {
    initialProps: { enabled: true, items: ITEMS, context: {}, ...initial },
    wrapper: createTestWrapper(createTestQueryClient(), adapter),
  });

  return { ...view, adapter };
}

/** Lets the first list's prepare, which waits for no change, go out and come back. */
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

/** A server that prepares every list and takes every change; each call is recorded. */
function serveHandoffs(update: () => boolean = () => true) {
  const answered = vi.fn(async (path: string, _input: unknown) => {
    if (path === "bring.prepare") return PREPARED;
    if (path === "bring.update") return update();

    return undefined;
  });

  serveTRPC(answered);

  return answered;
}

const callsTo = (answered: ReturnType<typeof serveHandoffs>, path: string) =>
  answered.mock.calls.filter(([called]) => called === path).map(([, input]) => input);

describe("useBringHandoff", () => {
  describe("preparing", () => {
    it("prepares the lines at once, with the recipe and servings they are for", async () => {
      const { result } = setup({ context: { recipeId: "r1", servings: 4 } });

      expect((await sentCall("bring.prepare")).input).toEqual({
        recipeId: "r1",
        servings: 4,
        items: ITEMS,
      });
      expect(result.current.status).toBe("preparing");

      await answerCall("bring.prepare", PREPARED);

      expect(result.current.status).toBe("ready");
    });

    it("stays idle, and asks nothing, while it is not enabled", async () => {
      const answered = serveHandoffs();
      const { result, rerender } = setup({ enabled: false });

      await flush();
      expect(answered).not.toHaveBeenCalled();
      expect(result.current.status).toBe("idle");

      rerender({ enabled: true, items: ITEMS, context: {} });
      await flush();

      expect(callsTo(answered, "bring.prepare")).toHaveLength(1);
      expect(result.current.status).toBe("ready");
    });

    it("stays idle, and asks nothing, while no line has a name", async () => {
      const answered = serveHandoffs();
      const { result } = setup({ items: [{ name: " " }, { name: "" }] });

      await flush();

      expect(answered).not.toHaveBeenCalled();
      expect(result.current.status).toBe("idle");
    });

    it("leaves out a line with no name, and prepares the rest", async () => {
      const answered = serveHandoffs();

      setup({ items: [{ name: "  " }, { name: "salt", amount: 0 }, { name: "" }] });
      await flush();

      expect(callsTo(answered, "bring.prepare")).toEqual([
        { items: [{ name: "salt", amount: 0 }] },
      ]);
    });

    it("prepares the first 150 lines of a longer list", async () => {
      const answered = serveHandoffs();

      setup({ items: Array.from({ length: 200 }, (_, index) => ({ name: `item ${index}` })) });
      await flush();

      const sent = (callsTo(answered, "bring.prepare")[0] as { items: { name: string }[] }).items;

      expect(sent).toHaveLength(150);
      expect(sent[0]).toEqual({ name: "item 0" });
      expect(sent[149]).toEqual({ name: "item 149" });
    });
  });

  describe("a change to the lines", () => {
    it("waits a moment for the next change, then changes the handoff once with the latest", async () => {
      vi.useFakeTimers();
      const answered = serveHandoffs();
      const { result, rerender } = setup();

      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(result.current.status).toBe("ready");

      const eggs = [...ITEMS, { name: "eggs", amount: 2 }];
      const butter = [...eggs, { name: "butter" }];

      rerender({ enabled: true, items: eggs, context: {} });
      expect(result.current.status).toBe("preparing");
      await act(() => vi.advanceTimersByTimeAsync(200));
      rerender({ enabled: true, items: butter, context: { servings: 2 } });
      await act(() => vi.advanceTimersByTimeAsync(299));

      expect(callsTo(answered, "bring.update")).toEqual([]);

      await act(() => vi.advanceTimersByTimeAsync(1));

      expect(callsTo(answered, "bring.update")).toEqual([
        { servings: 2, items: butter, token: TOKEN },
      ]);
      expect(callsTo(answered, "bring.prepare")).toHaveLength(1);
      expect(result.current.status).toBe("ready");
    });

    it("prepares a new handoff when the server no longer has the old one, and opens that", async () => {
      vi.useFakeTimers();
      const fresh = "https://getbring.onelink.me/fresh";
      const answered = vi.fn(async (path: string, _input: unknown) => {
        if (path === "bring.update") return false;

        return callsTo(answered, "bring.prepare").length === 1
          ? PREPARED
          : { ok: true, token: "F".repeat(32), deeplink: fresh };
      });

      serveTRPC(answered);
      const { result, rerender, adapter } = setup();

      await act(() => vi.advanceTimersByTimeAsync(0));
      const eggs = [...ITEMS, { name: "eggs" }];

      rerender({ enabled: true, items: eggs, context: {} });
      await act(() => vi.advanceTimersByTimeAsync(300));

      expect(callsTo(answered, "bring.update")).toEqual([{ items: eggs, token: TOKEN }]);
      expect(callsTo(answered, "bring.prepare")).toEqual([{ items: ITEMS }, { items: eggs }]);
      expect(result.current.status).toBe("ready");

      act(() => {
        result.current.open();
      });

      expect(adapter.openExternalUrl).toHaveBeenCalledExactlyOnceWith(fresh);
    });
  });

  describe("open", () => {
    it("opens the link from the press itself, with no toast, and answers true", async () => {
      serveHandoffs();
      const { result, adapter } = setup();

      await flush();

      let opened: boolean | undefined;

      act(() => {
        opened = result.current.open();
        // Opened before the press returned: nothing was awaited in between.
        expect(adapter.openExternalUrl).toHaveBeenCalledExactlyOnceWith(DEEPLINK);
      });

      expect(opened).toBe(true);
      expect(adapter.toast.show).not.toHaveBeenCalled();
    });

    it("opens nothing, and answers false, while the handoff is being prepared", async () => {
      const { result, adapter } = setup();

      await sentCall("bring.prepare");

      let opened: boolean | undefined;

      act(() => {
        opened = result.current.open();
      });

      expect(opened).toBe(false);
      expect(adapter.openExternalUrl).not.toHaveBeenCalled();
    });

    it("offers a persistent button whose press opens the link where the browser blocked the tab", async () => {
      serveHandoffs();
      const { result, adapter } = setup({}, false);

      await flush();

      let opened: boolean | undefined;

      act(() => {
        opened = result.current.open();
      });

      expect(opened).toBe(true);
      expect(adapter.toast.show).toHaveBeenCalledWith({
        severity: "success",
        title: "groceries.bring.ready",
        actionLabel: "groceries.bring.open",
        onActionPress: expect.any(Function),
        persistent: true,
      });

      vi.mocked(adapter.toast.show).mock.calls[0]![0].onActionPress?.();
      expect(adapter.openExternalUrl).toHaveBeenLastCalledWith(DEEPLINK);
      expect(adapter.openExternalUrl).toHaveBeenCalledTimes(2);
    });
  });

  describe("a failure", () => {
    it.each([
      ["not-bring", "failed"],
      ["not-public", "notPublic"],
      ["bring-unreachable", "unreachable"],
      ["bring-rejected", "rejected"],
      ["rate-limited", "rateLimited"],
      ["page-unreachable", "pageUnreachable"],
    ])("warns with the %s reason and shows the handoff failed", async (reason, key) => {
      const { result, adapter } = setup();

      await answerCall("bring.prepare", { ok: false, reason });

      expect(adapter.toast.show).toHaveBeenCalledExactlyOnceWith({
        severity: "warning",
        title: `groceries.bring.errors.${key}`,
      });
      expect(result.current.status).toBe("failed");
    });

    it("names the status Bring! got when it could not fetch the page", async () => {
      const { adapter } = setup();

      await answerCall("bring.prepare", { ok: false, reason: "page-unreachable", status: 403 });

      expect(adapter.toast.show).toHaveBeenCalledWith({
        severity: "warning",
        title: "groceries.bring.errors.pageUnreachable",
        description: "groceries.bring.errors.pageStatus",
      });
    });

    it("shows a thrown error, offline included, and shows the handoff failed", async () => {
      const { result, adapter } = setup();

      await failCall("bring.prepare");

      expect(adapter.showError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "offline" }),
        "bring:prepare",
        "groceries.bring.errors.failed"
      );
      expect(result.current.status).toBe("failed");
    });

    it("tries again on the next press, which opens nothing yet", async () => {
      const { result, adapter } = setup();

      await answerCall("bring.prepare", { ok: false, reason: "bring-unreachable" });

      let opened: boolean | undefined;

      act(() => {
        opened = result.current.open();
      });

      expect(opened).toBe(false);
      expect(adapter.openExternalUrl).not.toHaveBeenCalled();
      expect(result.current.status).toBe("preparing");
      expect((await sentCall("bring.prepare", 1)).input).toEqual({ items: ITEMS });

      await answerCall("bring.prepare", PREPARED, 1);

      expect(result.current.status).toBe("ready");
    });

    it("gives a list changed while the last one failed its own try, and fails only that one", async () => {
      const { result, rerender, adapter } = setup();
      const changed = [...ITEMS, { name: "eggs", amount: 2, unit: null }];

      await sentCall("bring.prepare");
      rerender({ enabled: true, items: changed, context: {} });
      await answerCall("bring.prepare", { ok: false, reason: "bring-unreachable" });

      expect(adapter.toast.show).not.toHaveBeenCalled();
      expect((await sentCall("bring.prepare", 1)).input).toEqual({ items: changed });

      await answerCall("bring.prepare", { ok: false, reason: "bring-unreachable" }, 1);

      expect(adapter.toast.show).toHaveBeenCalledOnce();
      expect(result.current.status).toBe("failed");
    });
  });

  describe("taking the handoff down", () => {
    it("discards a handoff the reader never opened when the sheet goes", async () => {
      const answered = serveHandoffs();
      const { unmount } = setup();

      await flush();
      unmount();
      await flush();

      expect(callsTo(answered, "bring.discard")).toEqual([{ token: TOKEN }]);
    });

    it("keeps a handoff the reader opened, for Bring! to read", async () => {
      const answered = serveHandoffs();
      const { result, unmount } = setup();

      await flush();
      act(() => {
        result.current.open();
      });
      unmount();
      await flush();

      expect(callsTo(answered, "bring.discard")).toEqual([]);
    });

    it("discards a handoff whose prepare came back after the sheet went", async () => {
      const { unmount } = setup();

      await sentCall("bring.prepare");
      unmount();
      await answerCall("bring.prepare", PREPARED);

      expect((await sentCall("bring.discard")).input).toEqual({ token: TOKEN });
    });

    it("discards nothing when nothing was prepared", async () => {
      const { unmount } = setup({ enabled: false });

      unmount();
      await flush();

      expect(trpcCalls["bring.discard"]).toBeUndefined();
    });
  });
});
