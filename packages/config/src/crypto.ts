import crypto from "crypto";

type DerivedKeys = { authSecret: string; encryption: Buffer; hmac: Buffer };

// On globalThis, so the copy of this module the Next bundle carries sees the key boot resolved.
const KEYS = Symbol.for("norish:master-key");
const g = globalThis as { [KEYS]?: DerivedKeys };

function deriveKey(masterKey: Buffer, label: string): Buffer {
  return Buffer.from(crypto.hkdfSync("sha256", masterKey, Buffer.alloc(0), Buffer.from(label), 32));
}

/** Take the Master Key boot resolved; nothing encrypts, decrypts, signs or hashes before this. */
export function initMasterKey(masterKey: Buffer): void {
  g[KEYS] = {
    authSecret: deriveKey(masterKey, "auth").toString("base64url"),
    encryption: deriveKey(masterKey, "encryption"),
    hmac: deriveKey(masterKey, "hmac"),
  };
}

function keys(): DerivedKeys {
  const derived = g[KEYS];

  if (!derived) throw new Error("The Master Key is used before boot resolved it");

  return derived;
}

/** Better Auth's `secret`. */
export function authSecret(): string {
  return keys().authSecret;
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keys().encryption, iv);

  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(enc: string): string {
  const data = Buffer.from(enc, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", keys().encryption, iv);

  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function hmacIndex(value: string): string {
  return crypto.createHmac("sha256", keys().hmac).update(value).digest("hex");
}

export function hashToken(token: string): string {
  return crypto.createHmac("sha256", keys().hmac).update(token).digest("hex");
}

export function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return decrypt(value);
  } catch {
    return value;
  }
}
