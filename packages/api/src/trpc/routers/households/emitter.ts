import type { HouseholdSubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

// Use globalThis to persist across HMR in development
declare global {
  var __householdEmitter__: TypedEmitter<HouseholdSubscriptionEvents> | undefined;
}

export const householdEmitter =
  globalThis.__householdEmitter__ ||
  (globalThis.__householdEmitter__ = createTypedEmitter<HouseholdSubscriptionEvents>("household"));
