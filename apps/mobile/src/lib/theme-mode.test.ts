import { describe, expect, it } from "vitest";

import { nextTheme } from "./theme-mode";

describe("nextTheme", () => {
  it("switches light to dark", () => {
    expect(nextTheme("light")).toBe("dark");
  });

  it("switches dark to light", () => {
    expect(nextTheme("dark")).toBe("light");
  });
});
