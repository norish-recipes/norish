/**
 * Central mock exports and setup
 */
export * from "./db";
export * from "./recurring-groceries";
export * from "./permissions";
export * from "./grocery-emitter";
export * from "./config";
export * from "./helpers";
export * from "./recurrence";

import { resetDbMocks } from "./db";
import { resetRecurringGroceriesMocks } from "./recurring-groceries";
import { resetPermissionsMocks } from "./permissions";
import { resetEmitterMocks } from "./grocery-emitter";
import { resetConfigMocks } from "./config";
import { resetHelpersMocks } from "./helpers";
import { resetRecurrenceMocks } from "./recurrence";

/**
 * Reset all mocks - call in beforeEach
 */
export function resetAllMocks() {
  resetDbMocks();
  resetRecurringGroceriesMocks();
  resetPermissionsMocks();
  resetEmitterMocks();
  resetConfigMocks();
  resetHelpersMocks();
  resetRecurrenceMocks();
}
