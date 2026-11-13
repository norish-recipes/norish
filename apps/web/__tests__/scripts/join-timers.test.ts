// @vitest-environment node
import { joinTimers } from "@/scripts/join-timers";
import { afterEach, describe, expect, it } from "vitest";

const { setTimeout: nativeSet, clearTimeout: nativeClear } = globalThis;
const sleep = (ms: number) => new Promise((resolve) => nativeSet(resolve, ms));

describe("joinTimers", () => {
  afterEach(() => {
    Object.assign(globalThis, { setTimeout: nativeSet, clearTimeout: nativeClear });
  });

  it("fires timers of one delay set close together in one task", async () => {
    const seen: string[] = [];

    joinTimers(16);
    setTimeout(() => {
      seen.push("first");
      queueMicrotask(() => seen.push("first's microtask"));
    }, 30);
    await sleep(8);
    setTimeout(() => seen.push("second"), 30);
    clearTimeout(setTimeout(() => seen.push("cleared"), 30));
    setTimeout(() => seen.push("another delay"), 35);
    // A debounce clears its only timer and sets the next one.
    clearTimeout(setTimeout(() => seen.push("cleared alone"), 40));
    setTimeout(() => seen.push("reset"), 40);
    await sleep(100);

    expect(seen).toEqual(["first", "second", "first's microtask", "another delay", "reset"]);
  });

  it("leaves zero-delay timers a task each", async () => {
    const seen: string[] = [];

    joinTimers(16);
    setTimeout(() => {
      seen.push("first");
      queueMicrotask(() => seen.push("first's microtask"));
    }, 0);
    setTimeout(() => seen.push("second"), 0);
    await sleep(20);

    expect(seen).toEqual(["first", "first's microtask", "second"]);
  });
});
