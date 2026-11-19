import { plainText } from "@/lib/plain-text";
import { describe, expect, it } from "vitest";

describe("plainText", () => {
  it("drops markdown marks and keeps link labels", () => {
    expect(plainText("**Mix** the [flour](http://x.y) _well_")).toBe("Mix the flour well");
  });
});
