import { createMMKV } from "react-native-mmkv";

/** The app's key-value store; an isolated namespace gets its own MMKV `id`, not a key prefix here. */
export const storage = createMMKV({ id: "norish-storage" });
