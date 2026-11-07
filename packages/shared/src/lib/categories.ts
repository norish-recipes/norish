/** The four Categories every household has: fixed, translated, never removed (ADR-0040). */
export const BUILT_IN_CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

export type BuiltInCategory = (typeof BUILT_IN_CATEGORIES)[number];

export function isBuiltInCategory(name: string): name is BuiltInCategory {
  return (BUILT_IN_CATEGORIES as readonly string[]).includes(name);
}
