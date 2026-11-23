import { confirmsDiscard } from "@/lib/discard-confirm";
import { describe, expect, it } from "vitest";

describe("confirmsDiscard", () => {
  it("asks only while unsynced changes would be lost", () => {
    expect(confirmsDiscard(0)).toBe(false);
    expect(confirmsDiscard(1)).toBe(true);
    expect(confirmsDiscard(12)).toBe(true);
  });
});
