import type { StoreSubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

// Use globalThis to persist across HMR in development
declare global {
  var __storeEmitter__: TypedEmitter<StoreSubscriptionEvents> | undefined;
}

export const storeEmitter =
  globalThis.__storeEmitter__ ||
  (globalThis.__storeEmitter__ = createTypedEmitter<StoreSubscriptionEvents>("store"));
