import crypto from "crypto";

type DerivedKeys = { authSecret: string; encryption: Buffer; hmac: Buffer };

// On globalThis, so the copy of this module the Next bundle carries sees the key boot resolved.
const DERIVED_KEYS = Symbol.for("norish:master-key");
const shared = globalThis as { [DERIVED_KEYS]?: DerivedKeys };

function deriveKey(masterKey: Buffer, label: string): Buffer {
  return Buffer.from(crypto.hkdfSync("sha256", masterKey, Buffer.alloc(0), Buffer.from(label), 32));
}

/** Take the Master Key boot resolved; nothing encrypts, decrypts, signs or hashes before this. */
export function initMasterKey(masterKey: Buffer): void {
  shared[DERIVED_KEYS] = {
    authSecret: deriveKey(masterKey, "auth").toString("base64url"),
    encryption: deriveKey(masterKey, "encryption"),
    hmac: deriveKey(masterKey, "hmac"),
  };
}

function derivedKeys(): DerivedKeys {
  const derived = shared[DERIVED_KEYS];

  if (!derived) throw new Error("The Master Key is used before boot resolved it");

  return derived;
}

/** Names a Master Key; its own label, so it tells nothing about the keys the Master Key yields. */
export function masterKeyFingerprint(masterKey: Buffer): string {
  return deriveKey(masterKey, "fingerprint").toString("hex");
}

/** Better Auth's `secret`. */
export function authSecret(): string {
  return derivedKeys().authSecret;
}

function encryptWith(encryptionKey: Buffer, plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);

  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function encrypt(plain: string): string {
  return encryptWith(derivedKeys().encryption, plain);
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

function decryptWith(encryptionKey: Buffer, enc: string): string {
  const data = Buffer.from(enc, "base64");
  const iv = data.subarray(0, IV_BYTES);
  const tag = data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const encrypted = data.subarray(IV_BYTES + TAG_BYTES);

  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv);

  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function decrypt(enc: string): string {
  return decryptWith(derivedKeys().encryption, enc);
}

/** `enc` in plain text, or null when `encryptionKey` did not write it. */
function tryDecryptWith(encryptionKey: Buffer, enc: string): string | null {
  try {
    return decryptWith(encryptionKey, enc);
  } catch {
    return null;
  }
}

/** Whether `masterKey` wrote `enc`, without making it the key in use. */
export function masterKeyOpens(masterKey: Buffer, enc: string): boolean {
  return tryDecryptWith(deriveKey(masterKey, "encryption"), enc) !== null;
}

const lookupWith = (hmacKey: Buffer, value: string) =>
  crypto.createHmac("sha256", hmacKey).update(value).digest("hex");

export function hmacIndex(value: string): string {
  return lookupWith(derivedKeys().hmac, value);
}

/** A share token's lookup hash: the same keyed HMAC as an email's. */
export const hashToken = hmacIndex;

/** Whether `value` has the shape `encrypt` writes: base64 of an IV, a tag and the data. */
function isCiphertext(value: string): boolean {
  const data = Buffer.from(value, "base64");

  return data.length >= IV_BYTES + TAG_BYTES && data.toString("base64") === value;
}

/**
 * Which key had sealed a value a re-key met: `plaintext` when it is not ciphertext, `unreadable`
 * when it is ciphertext neither key opens (damaged, or sealed under another key).
 */
export type SealedBy = "previous" | "current" | "plaintext" | "unreadable";

/**
 * A re-key from `previous` to `current`, its keys kept here. The only place a value that is not
 * ciphertext is read as plaintext; one the current key opens, or neither does, stays as it is.
 */
export function masterKeyRotation(previous: Buffer, current: Buffer) {
  const from = deriveKey(previous, "encryption");
  const to = deriveKey(current, "encryption");
  const hmac = deriveKey(current, "hmac");

  return {
    reseal(value: string): { sealed: string; plain: string | null; was: SealedBy } {
      const opened = tryDecryptWith(from, value);

      if (opened !== null)
        return { sealed: encryptWith(to, opened), plain: opened, was: "previous" };

      const already = tryDecryptWith(to, value);

      if (already !== null) return { sealed: value, plain: already, was: "current" };
      if (isCiphertext(value)) return { sealed: value, plain: null, was: "unreadable" };

      return { sealed: encryptWith(to, value), plain: value, was: "plaintext" };
    },
    /** `hmacIndex` and `hashToken` under the current key. */
    lookup: (plain: string) => lookupWith(hmac, plain),
  };
}

export type MasterKeyRotation = ReturnType<typeof masterKeyRotation>;
