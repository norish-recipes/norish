import crypto from "crypto";

import { SERVER_CONFIG } from "@norish/config/env-config-server";

export const AUTH_SECRET = deriveKey("auth").toString("base64url");
export const ENCRYPTION_KEY = deriveKey("encryption");
export const HMAC_KEY = deriveKey("hmac");
const IMPORT_LINK_KEY = deriveKey("import-link");

function deriveKey(label: string, length = 32): Buffer {
  const masterKey = Buffer.from(SERVER_CONFIG.MASTER_KEY, "base64"); // TODO: Generate this when the server is first set up

  const raw = crypto.hkdfSync("sha256", masterKey, Buffer.alloc(0), Buffer.from(label), length);

  return Buffer.from(raw);
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);

  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(enc: string): string {
  const data = Buffer.from(enc, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);

  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function hmacIndex(value: string): string {
  return crypto.createHmac("sha256", HMAC_KEY).update(value).digest("hex");
}

export function hashToken(token: string): string {
  return crypto.createHmac("sha256", HMAC_KEY).update(token).digest("hex");
}

/** The private code in a reader's bookmarklet, which lets it import without asking first. */
export function importLinkCode(userId: string): string {
  return crypto.createHmac("sha256", IMPORT_LINK_KEY).update(userId).digest("base64url");
}

export function isImportLinkCode(userId: string, code: string): boolean {
  const expected = Buffer.from(importLinkCode(userId));
  const given = Buffer.from(code);

  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

export function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return decrypt(value);
  } catch {
    return value;
  }
}
