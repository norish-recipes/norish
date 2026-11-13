import { hostOf, isWebLink } from "@/lib/network/host-of";
import { describe, expect, it } from "vitest";

describe("hostOf", () => {
  it("is a plain address's host", () => {
    expect(hostOf("https://norish.example.com")).toBe("norish.example.com");
  });

  it("keeps an IP's port", () => {
    expect(hostOf("http://192.168.1.20:3000")).toBe("192.168.1.20:3000");
  });

  it("drops a path prefix", () => {
    expect(hostOf("https://example.com/norish")).toBe("example.com");
  });

  it("is the address itself when it doesn't parse", () => {
    expect(hostOf("not a url")).toBe("not a url");
  });
});

describe("isWebLink", () => {
  it("is an absolute http(s) link, not a server path or a label", () => {
    expect(isWebLink("https://example.com/a")).toBe(true);
    expect(isWebLink("http://example.com")).toBe(true);
    expect(isWebLink("/recipes/1/image.jpg")).toBe(false);
    expect(isWebLink("[pasted]")).toBe(false);
  });
});
