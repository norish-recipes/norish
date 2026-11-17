/** The daily reference intakes for an average adult that a recipe's figures are shown against. */
export const DAILY_REFERENCE = { calories: 2000, protein: 50, carbs: 260, fat: 70 } as const;

/** How much of a reference a figure is, in whole percent; it can pass 100. */
export const percentOfReference = (value: number, reference: number) =>
  Math.round((value / reference) * 100);
