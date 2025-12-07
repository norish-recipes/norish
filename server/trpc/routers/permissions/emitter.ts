import type { PermissionsSubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

// Use globalThis to persist across HMR in development
declare global {
  // eslint-disable-next-line no-var
  var __permissionsEmitter__: TypedEmitter<PermissionsSubscriptionEvents> | undefined;
}

export const permissionsEmitter =
  globalThis.__permissionsEmitter__ ||
  (globalThis.__permissionsEmitter__ = createTypedEmitter<PermissionsSubscriptionEvents>());
