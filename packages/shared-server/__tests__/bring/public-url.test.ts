// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handoffUrl, isPubliclyReachable } from "@norish/shared-server/bring/public-url";

const serverConfig = vi.hoisted(() => ({
  AUTH_URL: "https://norish.example.com",
  BRING_API_URL: "https://api.getbring.com",
}));
const addressesOf = vi.hoisted(() => vi.fn());

vi.mock("@norish/config/env-config-server", () => ({ SERVER_CONFIG: serverConfig }));
vi.mock("@norish/shared-server/private-addresses", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/private-addresses")>()),
  addressesOf,
}));

beforeEach(() => {
  serverConfig.AUTH_URL = "https://norish.example.com";
  serverConfig.BRING_API_URL = "https://api.getbring.com";
  addressesOf.mockReset().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

describe("handoffUrl", () => {
  it("is AUTH_URL's origin and base path, then /share/bring/<token>", () => {
    expect(handoffUrl("tok")).toBe("https://norish.example.com/share/bring/tok");

    serverConfig.AUTH_URL = "https://example.com/norish/";
    expect(handoffUrl("tok")).toBe("https://example.com/norish/share/bring/tok");
  });
});

describe("isPubliclyReachable", () => {
  it("is true for an https host that resolves to a public address", async () => {
    await expect(isPubliclyReachable()).resolves.toBe(true);
  });

  it("is false for plain http", async () => {
    serverConfig.AUTH_URL = "http://norish.example.com";

    await expect(isPubliclyReachable()).resolves.toBe(false);
  });

  it("is false for a host that resolves to a private address", async () => {
    addressesOf.mockResolvedValue([{ address: "192.168.1.20", family: 4 }]);

    await expect(isPubliclyReachable()).resolves.toBe(false);
  });

  it("is false when any resolved address is private, or the name does not resolve", async () => {
    addressesOf.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "fd00::1", family: 6 },
    ]);
    await expect(isPubliclyReachable()).resolves.toBe(false);

    addressesOf.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(isPubliclyReachable()).resolves.toBe(false);
  });

  it("does not read ALLOW_PRIVATE_ADDRESSES, which means something else", async () => {
    serverConfig.AUTH_URL = "http://localhost:3000";
    Object.assign(serverConfig, { ALLOW_PRIVATE_ADDRESSES: true });

    try {
      await expect(isPubliclyReachable()).resolves.toBe(false);
    } finally {
      Reflect.deleteProperty(serverConfig, "ALLOW_PRIVATE_ADDRESSES");
    }
  });

  it("skips the check only when BRING_API_URL is not Bring!'s own address", async () => {
    serverConfig.AUTH_URL = "http://localhost:3000";
    serverConfig.BRING_API_URL = "http://localhost:4010";

    await expect(isPubliclyReachable()).resolves.toBe(true);
    expect(addressesOf).not.toHaveBeenCalled();
  });

  it("still checks when the default address is written with a trailing slash", async () => {
    serverConfig.AUTH_URL = "http://localhost:3000";
    serverConfig.BRING_API_URL = "https://api.getbring.com/";

    await expect(isPubliclyReachable()).resolves.toBe(false);
  });
});
