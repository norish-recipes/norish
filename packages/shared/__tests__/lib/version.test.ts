import { describe, expect, it } from "vitest";

import { isUpdateAvailable } from "@norish/shared/lib/version";

describe("isUpdateAvailable", () => {
  it("compares major, minor and patch, leaving out a suffix", () => {
    expect(isUpdateAvailable("0.25.3", "0.26.0-beta")).toBe(true);
    expect(isUpdateAvailable("0.26.0-beta", "0.26.0")).toBe(false);
    expect(isUpdateAvailable("0.26.0-rc-2", "0.26.1")).toBe(true);
    expect(isUpdateAvailable("1.0.0", "0.99.99")).toBe(false);
    expect(isUpdateAvailable("0.26.0", null)).toBe(false);
  });
});
