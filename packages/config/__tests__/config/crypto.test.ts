import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  authSecret,
  decrypt,
  encrypt,
  hashToken,
  hmacIndex,
  initMasterKey,
} from "@norish/config/crypto";

describe("the Master Key's derived keys", () => {
  beforeEach(() => {
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("norish:master-key")];
  });

  it("refuses to encrypt, decrypt, sign or hash before boot opened a key", () => {
    for (const use of [
      () => encrypt("x"),
      () => decrypt("eA=="),
      () => hmacIndex("x"),
      () => hashToken("x"),
      () => authSecret(),
    ]) {
      expect(use).toThrow("The Master Key is used before boot resolved it");
    }
  });

  it("reads back what it wrote, and another key cannot", () => {
    initMasterKey(randomBytes(32));
    const sealed = encrypt("ada@example.com");

    expect(decrypt(sealed)).toBe("ada@example.com");

    initMasterKey(randomBytes(32));
    expect(() => decrypt(sealed)).toThrow();
  });

  it("is shared with another copy of the module, as the Next bundle carries one", async () => {
    initMasterKey(randomBytes(32));
    const sealed = encrypt("shared");

    vi.resetModules();
    const copy = await import("@norish/config/crypto");

    expect(copy.decrypt(sealed)).toBe("shared");
    expect(copy.authSecret()).toBe(authSecret());
  });
});
