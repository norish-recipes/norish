import { labelFits } from "@/lib/label-fits";
import { describe, expect, it } from "vitest";

describe("labelFits", () => {
  it("does not know until the room and the label are measured", () => {
    expect(labelFits(null, 80, 42)).toBeNull();
    expect(labelFits(120, null, 42)).toBeNull();
  });

  it("keeps the label when it and its chrome fit the room", () => {
    expect(labelFits(122, 80, 42)).toBe(true);
    expect(labelFits(121, 80, 42)).toBe(false);
  });

  it("drops a long translation where a short label fits", () => {
    expect(labelFits(150, 40, 42)).toBe(true);
    expect(labelFits(150, 120, 42)).toBe(false);
  });

  it("keeps a label with a fractional width to spare", () => {
    expect(labelFits(116.5, 74.33, 38)).toBe(true);
  });
});
