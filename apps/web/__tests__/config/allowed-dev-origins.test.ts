import { withExtraDevOrigins } from "@/config/allowed-dev-origins";
import { describe, expect, it } from "vitest";

const DEFAULTS = ["localhost", "*.local"];

describe("withExtraDevOrigins", () => {
  it("returns the defaults when ALLOWED_DEV_ORIGINS is unset or empty", () => {
    expect(withExtraDevOrigins(DEFAULTS, undefined)).toEqual(DEFAULTS);
    expect(withExtraDevOrigins(DEFAULTS, "")).toEqual(DEFAULTS);
  });

  it("appends comma-separated hosts, trimming blanks and duplicates", () => {
    expect(withExtraDevOrigins(DEFAULTS, " *.devbox.test, ,norish.example.com,localhost ")).toEqual(
      ["localhost", "*.local", "*.devbox.test", "norish.example.com"]
    );
  });
});
