import type { PlannedMeal } from "./planned-meal.types";

// IDs reference entries from recipe-mock-data.ts
export const TODAYS_MEALS_MOCK: PlannedMeal[] = [
  {
    slot: "Breakfast",
    recipeId: "mobile-recipe-3",
    recipeTitle: "Blueberry Almond Overnight Oats",
    imageUrl:
      "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=800&q=80",
    totalDurationMinutes: 10,
  },
  {
    slot: "Lunch",
    recipeId: "mobile-recipe-2",
    recipeTitle: "Mediterranean Quinoa Bowl",
    imageUrl:
      "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80",
    totalDurationMinutes: 25,
  },
  {
    slot: "Dinner",
    recipeId: null,
    recipeTitle: null,
    imageUrl: null,
    totalDurationMinutes: null,
  },
  {
    slot: "Snack",
    recipeId: null,
    recipeTitle: null,
    imageUrl: null,
    totalDurationMinutes: null,
  },
];
