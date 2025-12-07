import type { CaldavSubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

// Use globalThis to persist across HMR in development
declare global {
  // eslint-disable-next-line no-var
  var __caldavEmitter__: TypedEmitter<CaldavSubscriptionEvents> | undefined;
}

export const caldavEmitter =
  globalThis.__caldavEmitter__ ||
  (globalThis.__caldavEmitter__ = createTypedEmitter<CaldavSubscriptionEvents>());
