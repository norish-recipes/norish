import { confirmsDiscard, leaveConfirm } from "@/lib/discard-confirm";
import { describe, expect, it } from "vitest";

describe("confirmsDiscard", () => {
  it("asks only while unsynced changes would be lost", () => {
    expect(confirmsDiscard(0)).toBe(false);
    expect(confirmsDiscard(1)).toBe(true);
    expect(confirmsDiscard(12)).toBe(true);
  });
});

describe("leaveConfirm", () => {
  it("shows one alert: discard first, then the server warning, else none", () => {
    expect(leaveConfirm(3, true)).toBe("discard");
    expect(leaveConfirm(3, false)).toBe("discard");
    expect(leaveConfirm(0, true)).toBe("server");
    expect(leaveConfirm(0, false)).toBeNull();
  });
});
