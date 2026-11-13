import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";

import type { GroceriesData } from "../types";

/** Rows a test makes are told apart by a counter. */
let made = 0;

export function createMockGrocery(overrides: Partial<GroceryDto> = {}): GroceryDto {
  made += 1;

  return {
    id: `grocery-${made}`,
    version: 1,
    name: "Test Grocery",
    amount: 1,
    unit: "piece",
    isDone: false,
    recipeIngredientId: null,
    recurringGroceryId: null,
    storeId: null,
    sortOrder: 0,
    ...overrides,
  };
}

export function createMockRecurringGrocery(
  overrides: Partial<RecurringGroceryDto> = {}
): RecurringGroceryDto {
  made += 1;

  return {
    id: `recurring-${made}`,
    version: 1,
    name: "Test Recurring",
    amount: 1,
    unit: "piece",
    recurrenceRule: "week",
    recurrenceInterval: 1,
    recurrenceWeekday: null,
    nextPlannedFor: "2025-01-15",
    lastCheckedDate: null,
    ...overrides,
  };
}

export function createMockGroceriesData(
  groceries: GroceryDto[] = [],
  recurringGroceries: RecurringGroceryDto[] = []
): GroceriesData {
  return { groceries, recurringGroceries, recipeMap: {} };
}
