import { resetConfigMocks } from "./config";
import { resetDbMocks } from "./db";
import { resetEmitterMocks } from "./grocery-emitter";
import { resetHelpersMocks } from "./helpers";
import { resetPermissionsMocks } from "./permissions";
import { resetRecurrenceMocks } from "./recurrence";
import { resetRecurringGroceriesMocks } from "./recurring-groceries";

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
