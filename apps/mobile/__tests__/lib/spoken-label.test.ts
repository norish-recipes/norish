import { spokenLabel } from "@/lib/spoken-label";
import { describe, expect, it } from "vitest";

describe("spokenLabel", () => {
  it("joins only the parts that say something", () => {
    expect(spokenLabel("heritage tomato", "", undefined, "Remove heritage tomato")).toBe(
      "heritage tomato, Remove heritage tomato"
    );
    expect(spokenLabel("basil", " ", null, false)).toBe("basil");
    expect(spokenLabel()).toBe("");
  });
});
