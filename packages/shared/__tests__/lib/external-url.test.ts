import { describe, expect, it } from "vitest";

import { isOpenableExternalUrl } from "../../src/lib/external-url";

describe("isOpenableExternalUrl", () => {
  it("allows http and https addresses", () => {
    expect(isOpenableExternalUrl("https://getbring.onelink.me/abc")).toBe(true);
    expect(isOpenableExternalUrl("http://localhost:4010/open")).toBe(true);
  });

  it("refuses every other scheme and anything that is not a URL", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "file:///etc/passwd",
      "bring://x",
      "",
      "no url",
    ]) {
      expect(isOpenableExternalUrl(url)).toBe(false);
    }
  });
});
