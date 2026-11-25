import { initMasterKey } from "../../src/crypto";

/** Open a base64 Master Key, as boot opens MASTER_KEY. */
export function openBase64MasterKey(masterKey: string): void {
  initMasterKey(Buffer.from(masterKey, "base64"));
}

/** Close the open Master Key, as before boot resolved one. */
export function forgetMasterKey(): void {
  delete (globalThis as Record<symbol, unknown>)[Symbol.for("norish:master-key")];
}
