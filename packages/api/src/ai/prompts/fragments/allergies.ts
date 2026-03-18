/**
 * Allergy detection prompt fragments.
 *
 * These fragments are appended to recipe extraction prompts to guide
 * the AI in detecting or skipping allergy/dietary tags.
 */

export interface AllergyInstructionOptions {
  /**
   * When true, uses stricter wording ("MUST", "NEVER") to emphasize
   * that only the specified allergens should be detected.
   * Used for text-based extraction where hallucination is more common.
   */
  strict?: boolean;
}

/**
 * Build the allergy detection instruction fragment for recipe extraction prompts.
 *
 * @param allergies - List of allergens to detect. If empty/undefined, detection is skipped.
 * @param options - Configuration options for the instruction.
 * @returns A prompt fragment to append to the main extraction prompt.
 *
 * @example
 * ```ts
 * const instruction = buildAllergyInstruction(["gluten", "dairy"], { strict: true });
 * const fullPrompt = `${basePrompt}${instruction}`;
 * ```
 */
export function buildAllergyInstruction(
  allergies?: string[],
  options: AllergyInstructionOptions = {}
): string {
  const { strict = false } = options;

  if (!allergies || allergies.length === 0) {
    return "\nALLERGY DETECTION: Skip allergy/dietary tag detection. Do not add any tags to the keywords array.";
  }

  const allergenList = allergies.join(", ");

  if (strict) {
    // Used for HTML/text extraction where AI may hallucinate additional tags
    return `
ALLERGY DETECTION (STRICT):
- The "keywords" array MUST contain ONLY items from this list: ${allergenList}
- Do NOT add dietary tags, cuisine tags, or descriptive tags
- If none are present, return an empty array
- NEVER add additional keywords
`;
  }

  // Standard instruction for image/video extraction
  return `\nALLERGY DETECTION: Only detect these specific allergens/dietary tags from the ingredients: ${allergenList}. Do not add any other allergy tags.`;
}
