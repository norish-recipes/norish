import { getBackendWsUrl } from "@/lib/network/backend-ws-url";
import { describe, expect, it } from "vitest";

describe("getBackendWsUrl", () => {
  it("connects at /trpc on a server at the domain root", () => {
    expect(getBackendWsUrl("https://norish.example.com")).toBe("wss://norish.example.com/trpc");
  });

  it("connects under the server's base path", () => {
    expect(getBackendWsUrl("http://192.168.1.5:3000/norish")).toBe(
      "ws://192.168.1.5:3000/norish/trpc"
    );
  });

  it("ignores a trailing slash after the base path", () => {
    expect(getBackendWsUrl("https://example.com/apps/norish/")).toBe(
      "wss://example.com/apps/norish/trpc"
    );
  });
});
