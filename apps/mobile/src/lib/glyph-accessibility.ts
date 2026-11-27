/** A glyph reads as a stray character inside its row's label, so it is decoration; one given its
 * own `accessibilityLabel` is spoken. An icon-only button is labelled by its pressable. */
export const glyphAccessibility = (label: string | undefined) =>
  label
    ? {}
    : {
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants" as const,
      };
