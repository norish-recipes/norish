export type PlannedMeal = {
  slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  recipeId: string | null;
  recipeTitle: string | null;
  imageUrl: string | null;
  totalDurationMinutes: number | null;
};
