/**
 * Unit Form Selector
 *
 * Selects the grammatically correct unit form (singular or plural) based on quantity.
 *
 * Rules:
 * - quantity > 1: use plural form
 * - quantity <= 1 (including 0, 0.5, 1, null, undefined): use singular form
 */

/**
 * Information about available unit forms.
 */
export interface UnitFormInfo {
  /** The singular form of the unit (e.g., "gram") */
  singular: string | null;
  /** The plural form of the unit (e.g., "grams") */
  plural: string | null;
}

/**
 * Selects the grammatically correct unit form based on quantity.
 *
 * @param quantity - The quantity of the ingredient (null/undefined treated as singular)
 * @param unitInfo - Object containing singular and plural forms
 * @returns The appropriate unit form, or null if no forms available
 *
 * @example
 * selectUnitForm(2, { singular: "gram", plural: "grams" }) // "grams"
 * selectUnitForm(1, { singular: "gram", plural: "grams" }) // "gram"
 * selectUnitForm(0.5, { singular: "cup", plural: "cups" }) // "cup"
 */
export function selectUnitForm(
  quantity: number | null | undefined,
  unitInfo: UnitFormInfo | null | undefined
): string | null {
  // Handle missing unit info
  if (!unitInfo) {
    return null;
  }

  const { singular, plural } = unitInfo;

  // Determine if we should use plural (quantity > 1)
  const usePlural = quantity != null && quantity > 1;

  if (usePlural) {
    // Try plural first, fall back to singular
    return plural ?? singular ?? null;
  } else {
    // Try singular first, fall back to plural
    return singular ?? plural ?? null;
  }
}
