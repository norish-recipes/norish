import { afterEach, describe, expect, it, vi } from "vitest";

import { joinCodeStatus } from "../household-rules";
import { everySecondUntil, nowToTheSecond } from "../join-code-clock";

describe("everySecondUntil", () => {
  afterEach(() => vi.useRealTimers());

  it("ticks each second and stops by itself once the code has expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const onTick = vi.fn();

    everySecondUntil(3500)(onTick);
    vi.advanceTimersByTime(3000);
    expect(onTick).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops when unsubscribed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const stop = everySecondUntil(60_000)(() => undefined);

    stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts no timer for a code that has already expired, and one again once regenerated", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    everySecondUntil(5_000)(() => undefined);
    everySecondUntil(10_000)(() => undefined);
    expect(vi.getTimerCount()).toBe(0);

    const stop = everySecondUntil(70_000)(() => undefined);

    expect(vi.getTimerCount()).toBe(1);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("runs a timer for a code the second-rounded clock still shows live", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5_500);

    const code = { joinCode: "123456", joinCodeExpiresAt: new Date(5_400) };
    const onTick = vi.fn();

    expect(joinCodeStatus(code, nowToTheSecond()).kind).toBe("active");
    everySecondUntil(5_400)(onTick);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(joinCodeStatus(code, nowToTheSecond()).kind).toBe("expired");
    expect(vi.getTimerCount()).toBe(0);
  });
});
