import { describe, expect, it } from "vitest";

import { deviceKindFromUserAgent } from "@norish/shared/lib/device-kind";

describe("deviceKindFromUserAgent", () => {
  it.each([
    {
      name: "iPhone Safari",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      kind: "phone",
    },
    {
      name: "iPhone home-screen app",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
      kind: "phone",
    },
    {
      name: "Android phone (reduced user agent)",
      userAgent:
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
      kind: "phone",
    },
    {
      name: "Android tablet",
      userAgent:
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      kind: "desktop",
    },
    {
      name: "iPad in desktop mode",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      kind: "desktop",
    },
    {
      name: "Mac Chrome",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      kind: "desktop",
    },
    {
      name: "Windows Edge",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
      kind: "desktop",
    },
    { name: "no user agent", userAgent: null, kind: "desktop" },
  ])("$name is a $kind", ({ userAgent, kind }) => {
    expect(deviceKindFromUserAgent(userAgent)).toBe(kind);
  });
});
