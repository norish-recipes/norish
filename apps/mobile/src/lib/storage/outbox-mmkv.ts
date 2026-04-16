import { MMKV } from "react-native-mmkv";

/**
 * Dedicated MMKV instance for the mutation outbox.
 *
 * Isolated from general and query-cache storage so outbox reads/writes
 * never interfere with other persisted data.
 */
export const outboxStorage = new MMKV({ id: "norish-outbox" });
