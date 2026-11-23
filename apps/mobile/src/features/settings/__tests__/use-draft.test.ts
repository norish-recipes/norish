// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DraftWrite } from "../utils/draft-rules";

vi.mock("@/lib/offline/offline-now", () => ({ isOfflineNow: () => false }));

const { useDraft } = await import("../hooks/use-draft");
const { listenForNoAnswer, SETTINGS_WRITE_TIMEOUT_MS } = await import("../utils/settings-write");

const NAME: DraftWrite<string> = {
  sent: (draft) => draft,
  changes: (sent, saved) => sent !== saved,
};

describe("a draft's save", () => {
  afterEach(() => vi.useRealTimers());

  it("frees Save when its request goes unanswered, and sends a repeat once", async () => {
    vi.useFakeTimers();
    const stopListening = listenForNoAnswer(vi.fn());
    const send = vi.fn(() => new Promise<boolean>(() => {}));
    const { result } = renderHook(() => useDraft(NAME, "Ann", { offline: false, key: "name" }));

    act(() => result.current.setDraft("Bea"));
    act(() => {
      void result.current.save(() => result.current.request(send)("Bea"));
      void result.current.request(send)("Bea");
    });
    expect(send).toHaveBeenCalledOnce();
    expect(result.current.canSave()).toBe(false);

    await act(() => vi.advanceTimersByTimeAsync(SETTINGS_WRITE_TIMEOUT_MS));
    expect(result.current.saving).toBe(false);
    expect(result.current.canSave()).toBe(true);
    stopListening();
  });
});
