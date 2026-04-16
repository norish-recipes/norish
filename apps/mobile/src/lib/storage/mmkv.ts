import { MMKV } from "react-native-mmkv";

/**
 * Shared MMKV storage instance for the mobile app.
 *
 * All general-purpose key-value persistence goes through this instance.
 * If a feature needs an isolated namespace, create a separate MMKV instance
 * with its own `id` rather than adding key prefixes here.
 */
export const storage = new MMKV({ id: "norish-storage" });
