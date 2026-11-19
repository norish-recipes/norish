import { plainText, snippetText } from "@/lib/plain-text";
import { describe, expect, it } from "vitest";

describe("plainText", () => {
  it("drops markdown marks and keeps link labels", () => {
    expect(plainText("**Mix** the [flour](http://x.y) _well_")).toBe("Mix the flour well");
  });

  it("leaves an unpaired marker of a whole text as written, as markdown does", () => {
    expect(plainText("Add **basil and stir")).toBe("Add **basil and stir");
  });
});

describe("snippetText", () => {
  it("also drops the markers a cut leaves unpaired", () => {
    expect(snippetText("Add **basil and [the oil](http://x")).toBe("Add basil and the oil");
    expect(snippetText("**Mix** the [flour](http://x.y) _well_")).toBe("Mix the flour well");
  });
});
