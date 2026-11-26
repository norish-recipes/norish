import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  authSecret,
  decrypt,
  encrypt,
  hashToken,
  hmacIndex,
  initMasterKey,
  masterKeyFingerprint,
  masterKeyOpens,
  masterKeyRotation,
} from "@norish/config/crypto";
import { getSchemaForConfigKey, ServerConfigKeys } from "@norish/config/zod/server-config";

import { forgetMasterKey } from "../helpers/master-key";

describe("the Master Key's derived keys", () => {
  beforeEach(() => {
    forgetMasterKey();
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

  it("shows a key opens data only with ciphertext that key wrote", () => {
    const key = randomBytes(32);

    initMasterKey(key);
    const sealed = encrypt("ada@example.com");
    // An IV and a 4-byte tag: a short tag must not let a guess through.
    const truncated = Buffer.from(sealed, "base64").subarray(0, 16).toString("base64");

    expect(masterKeyOpens(key, sealed)).toBe(true);
    expect(masterKeyOpens(randomBytes(32), sealed)).toBe(false);
    for (const value of ["", "ada@example.com", "bm90IGNpcGhlcnRleHQ=", truncated]) {
      expect(masterKeyOpens(key, value)).toBe(false);
    }
  });

  it("fingerprints a key in the shape the fingerprint setting accepts", () => {
    const schema = getSchemaForConfigKey(ServerConfigKeys.MASTER_KEY_FINGERPRINT);

    expect(schema.parse(masterKeyFingerprint(randomBytes(32)))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("a re-key from the previous key to the current one", () => {
  const previous = randomBytes(32);
  const current = randomBytes(32);
  const rotation = masterKeyRotation(previous, current);

  /** `plain` as `key` encrypts it, with no key left open. */
  function sealedBy(key: Buffer, plain: string): string {
    initMasterKey(key);
    const sealed = encrypt(plain);

    forgetMasterKey();

    return sealed;
  }

  /** What `key` reads `sealed` as; it throws when `key` did not write it. */
  function openedBy(key: Buffer, sealed: string): string {
    initMasterKey(key);

    try {
      return decrypt(sealed);
    } finally {
      forgetMasterKey();
    }
  }

  it("moves what the previous key sealed under the current key alone", () => {
    const moved = rotation.reseal(sealedBy(previous, "ada@example.com"));

    expect(moved).toMatchObject({ plain: "ada@example.com", was: "previous" });
    expect(openedBy(current, moved.sealed)).toBe("ada@example.com");
    expect(() => openedBy(previous, moved.sealed)).toThrow();
  });

  it("keeps what the current key sealed already, rather than sealing it again", () => {
    const sealed = sealedBy(current, "ada@example.com");

    expect(rotation.reseal(sealed)).toEqual({ sealed, plain: "ada@example.com", was: "current" });
  });

  it("seals a value neither key opens as the plain text it is", () => {
    const foreign = sealedBy(randomBytes(32), "x");

    for (const value of ["ada@example.com", "bm90IGNpcGhlcnRleHQ=", foreign]) {
      const moved = rotation.reseal(value);

      expect(moved).toMatchObject({ plain: value, was: "plaintext" });
      expect(openedBy(current, moved.sealed)).toBe(value);
    }
  });

  it("hashes a lookup as the current key's hmacIndex and hashToken do", () => {
    initMasterKey(current);

    expect(rotation.lookup("ada@example.com")).toBe(hmacIndex("ada@example.com"));
    expect(rotation.lookup("share-token")).toBe(hashToken("share-token"));
  });

  it("leaves the key in use alone", () => {
    initMasterKey(previous);
    const sealed = encrypt("ada@example.com");

    rotation.reseal(sealed);

    expect(decrypt(sealed)).toBe("ada@example.com");
  });
});
