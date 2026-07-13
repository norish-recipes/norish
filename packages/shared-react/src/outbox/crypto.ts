import type { EncryptedPayload } from "./outbox-types";
import {
  openWebOutboxDatabase,
  OUTBOX_STORES,
  requestResult,
  waitForTransaction,
} from "./database";

const KEY_ID = "origin-encryption-key";

function getSubtleCrypto(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable; durable mutation delivery cannot be enabled");
  }

  return globalThis.crypto.subtle;
}

async function getOriginKey(): Promise<CryptoKey> {
  const database = await openWebOutboxDatabase();

  try {
    const readTransaction = database.transaction(OUTBOX_STORES.keys, "readonly");
    const stored = await requestResult<{ id: string; key: CryptoKey } | undefined>(
      readTransaction.objectStore(OUTBOX_STORES.keys).get(KEY_ID)
    );

    if (stored?.key) {
      return stored.key;
    }

    const key = await getSubtleCrypto().generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    const writeTransaction = database.transaction(OUTBOX_STORES.keys, "readwrite");

    try {
      // `add` makes key creation safe when two tabs initialize the origin at
      // the same time; only one candidate can win the unique key slot.
      writeTransaction.objectStore(OUTBOX_STORES.keys).add({ id: KEY_ID, key });
      await waitForTransaction(writeTransaction);

      return key as CryptoKey;
    } catch {
      const retryTransaction = database.transaction(OUTBOX_STORES.keys, "readonly");
      const winner = await requestResult<{ id: string; key: CryptoKey } | undefined>(
        retryTransaction.objectStore(OUTBOX_STORES.keys).get(KEY_ID)
      );

      if (winner?.key) return winner.key;

      throw new Error("Unable to establish the origin encryption key");
    }
  } finally {
    database.close();
  }
}

export async function encryptOutboxPayload(value: string): Promise<EncryptedPayload> {
  const key = await getOriginKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(value);
  const ciphertext = await getSubtleCrypto().encrypt({ name: "AES-GCM", iv }, key, plaintext);

  return { iv: iv.buffer, ciphertext };
}

export async function decryptOutboxPayload(payload: EncryptedPayload): Promise<string> {
  const key = await getOriginKey();
  const plaintext = await getSubtleCrypto().decrypt(
    { name: "AES-GCM", iv: payload.iv },
    key,
    payload.ciphertext
  );

  return new TextDecoder().decode(plaintext);
}
