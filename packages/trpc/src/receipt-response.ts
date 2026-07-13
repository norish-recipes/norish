import superjson from "superjson";

import { decrypt, encrypt } from "@norish/config/crypto";

/** Serialize and encrypt a complete tRPC middleware result for exact replay. */
export function serializeReceiptResponse(value: unknown): string {
  return encrypt(superjson.stringify(value));
}

export function deserializeReceiptResponse<T>(value: string): T {
  return superjson.parse<T>(decrypt(value));
}
