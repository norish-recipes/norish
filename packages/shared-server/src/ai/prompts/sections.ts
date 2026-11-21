/**
 * The household's Categories as an appended prompt section (ADR-0016): the
 * only names auto-categorization and extraction may give (ADR-0040).
 */
export function householdCategoriesSection(categories: readonly string[]): string {
  return ["HOUSEHOLD CATEGORIES:", ...categories.map((category) => `- ${category}`)].join("\n");
}
