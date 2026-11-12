import { progress } from "@/lib/motion/progress";
import { describe, expect, it } from "vitest";

describe("progress", () => {
  it("runs from 0 at the start to 1 at the end", () => {
    expect(progress(100, 100, 300)).toBe(0);
    expect(progress(200, 100, 300)).toBe(0.5);
    expect(progress(300, 100, 300)).toBe(1);
  });

  it("holds at 0 before the start and at 1 after the end", () => {
    expect(progress(0, 100, 300)).toBe(0);
    expect(progress(900, 100, 300)).toBe(1);
  });
});
