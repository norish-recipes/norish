/** Sending lines to Bring!: how the reader gets there, and what each failure says. */
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { resetTRPCFake, serveTRPC, trpcCalls } from "../../trpc/testing";
import { useSendToBring } from "../use-send-to-bring";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

afterEach(resetTRPCFake);

const DEEPLINK = "https://getbring.onelink.me/abc";
const ITEMS = [{ name: "flour", amount: 200, unit: "g" }];

/** `opens` is whether the platform lets the link open, as a browser that did not block the tab. */
function setup(opens = true) {
  const adapter = { ...fakePlatformAdapter(), openExternalUrl: vi.fn(() => opens) };
  const view = renderHook(() => useSendToBring(), {
    wrapper: createTestWrapper(createTestQueryClient(), adapter),
  });

  return { ...view, adapter };
}

describe("useSendToBring", () => {
  it("sends the items with the recipe and servings they are for", async () => {
    const answered = vi.fn(async () => ({ ok: true, deeplink: DEEPLINK }));

    serveTRPC(answered);
    const { result } = setup();

    await result.current(ITEMS, { recipeId: "r1", servings: 4 });

    expect(answered).toHaveBeenCalledWith("bring.send", {
      recipeId: "r1",
      servings: 4,
      items: ITEMS,
    });
  });

  it("opens the link as soon as it is back, with no toast, and answers true", async () => {
    serveTRPC(async () => ({ ok: true, deeplink: DEEPLINK }));
    const { result, adapter } = setup();

    expect(await result.current(ITEMS, {})).toBe(true);

    expect(adapter.openExternalUrl).toHaveBeenCalledExactlyOnceWith(DEEPLINK);
    expect(adapter.toast.show).not.toHaveBeenCalled();
  });

  it("offers a persistent button whose press opens the link where the browser blocked the tab", async () => {
    serveTRPC(async () => ({ ok: true, deeplink: DEEPLINK }));
    const { result, adapter } = setup(false);

    expect(await result.current(ITEMS, {})).toBe(true);

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

  it("names the status Bring! got when it could not fetch the page", async () => {
    serveTRPC(async () => ({ ok: false, reason: "page-unreachable", status: 403 }));
    const { result, adapter } = setup();

    expect(await result.current(ITEMS, {})).toBe(false);

    expect(adapter.openExternalUrl).not.toHaveBeenCalled();
    expect(adapter.toast.show).toHaveBeenCalledWith({
      severity: "warning",
      title: "groceries.bring.errors.pageUnreachable",
      description: "groceries.bring.errors.pageStatus",
    });
  });

  it.each([
    ["not-bring", "failed"],
    ["not-public", "notPublic"],
    ["bring-unreachable", "unreachable"],
    ["bring-rejected", "rejected"],
    ["rate-limited", "rateLimited"],
    ["page-unreachable", "pageUnreachable"],
  ])("warns with the %s reason and answers false", async (reason, key) => {
    serveTRPC(async () => ({ ok: false, reason }));
    const { result, adapter } = setup();

    expect(await result.current(ITEMS, {})).toBe(false);

    expect(adapter.toast.show).toHaveBeenCalledWith({
      severity: "warning",
      title: `groceries.bring.errors.${key}`,
    });
    expect(adapter.openExternalUrl).not.toHaveBeenCalled();
  });

  describe("one odd line does not fail the send", () => {
    it("leaves out a line with no name, and sends the rest", async () => {
      const answered = vi.fn(async () => ({ ok: true, deeplink: DEEPLINK }));

      serveTRPC(answered);
      const { result } = setup();

      await result.current([{ name: "  " }, { name: "salt", amount: 0 }, { name: "" }], {});

      expect(answered).toHaveBeenCalledWith("bring.send", { items: [{ name: "salt", amount: 0 }] });
    });

    it("sends the first 150 lines of a longer list", async () => {
      const answered = vi.fn(async () => ({ ok: true, deeplink: DEEPLINK }));

      serveTRPC(answered);
      const { result } = setup();
      const many = Array.from({ length: 200 }, (_, index) => ({ name: `item ${index}` }));

      await result.current(many, {});

      const sent = (answered.mock.calls[0] as unknown as [string, { items: { name: string }[] }])[1]
        .items;

      expect(sent).toHaveLength(150);
      expect(sent[0]).toEqual({ name: "item 0" });
      expect(sent[149]).toEqual({ name: "item 149" });
    });

    it("asks nothing, and says so, when no line has a name", async () => {
      const answered = vi.fn();

      serveTRPC(answered);
      const { result, adapter } = setup();

      expect(await result.current([{ name: " " }], {})).toBe(false);

      expect(answered).not.toHaveBeenCalled();
      expect(adapter.toast.show).toHaveBeenCalledWith({
        severity: "warning",
        title: "groceries.bring.errors.failed",
      });
    });
  });

  it("shows a thrown error, offline included, and answers false", async () => {
    const offline = new Error("offline");

    serveTRPC(async () => {
      throw offline;
    });
    const { result, adapter } = setup();

    expect(await result.current(ITEMS, {})).toBe(false);

    expect(adapter.showError).toHaveBeenCalledWith(
      offline,
      "bring:send",
      "groceries.bring.errors.failed"
    );
    expect(trpcCalls).toEqual({});
  });
});
