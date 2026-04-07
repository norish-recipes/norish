import type { RecipeCardItem } from "@/lib/recipes/recipe-card.types";

type MockRecipeRecord = Omit<RecipeCardItem, "rating"> & {
  rating: number;
};

const MOCK_HOME_RECIPES: MockRecipeRecord[] = [
  {
    id: "mobile-recipe-1",
    version: 1,
    ownerId: "user-1",
    imageUrl:
      "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80",
    title: "One-Pan Lemon Herb Chicken",
    description:
      "Juicy chicken thighs with roasted potatoes, lemon zest, and rosemary in a weeknight-friendly single pan.",
    servings: 4,
    rating: 5,
    tags: ["weeknight", "high-protein", "family"],
    categories: ["Dinner"],
    course: "Dinner",
    liked: true,
    totalDurationMinutes: 45,
  },
  {
    id: "mobile-recipe-2",
    version: 1,
    ownerId: "user-2",
    imageUrl:
      "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80",
    title: "Mediterranean Quinoa Bowl",
    description:
      "Fluffy quinoa layered with cucumbers, tomatoes, olives, chickpeas, and a tangy tahini drizzle.",
    servings: 2,
    rating: 4,
    tags: ["meal-prep", "vegetarian", "fresh"],
    categories: ["Lunch"],
    course: "Lunch",
    liked: false,
    totalDurationMinutes: 25,
  },
  {
    id: "mobile-recipe-3",
    version: 1,
    ownerId: "user-1",
    imageUrl:
      "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=1200&q=80",
    title: "Blueberry Almond Overnight Oats",
    description:
      "Creamy oats soaked with almond milk, chia seeds, cinnamon, and a bright blueberry compote topping.",
    servings: 1,
    rating: 3,
    tags: ["no-cook", "make-ahead", "quick"],
    categories: ["Breakfast"],
    course: "Breakfast",
    liked: true,
    totalDurationMinutes: 10,
  },
  {
    id: "mobile-recipe-4",
    version: 1,
    ownerId: "user-3",
    imageUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
    title: "Roasted Veggie Pasta Primavera",
    description:
      "Tender pasta tossed with charred seasonal vegetables, garlic, basil, and shaved parmesan for a bright finish.",
    servings: 3,
    rating: 2,
    tags: ["vegetarian", "comfort-food", "pantry"],
    categories: ["Dinner"],
    course: "Dinner",
    liked: false,
    totalDurationMinutes: 35,
  },
  {
    id: "mobile-recipe-5",
    version: 1,
    ownerId: "user-2",
    imageUrl:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
    title: "Spiced Lentil Soup",
    description:
      "Warming red lentil soup with cumin, smoked paprika, and a squeeze of lemon - simple, filling, and freezer-friendly.",
    servings: 4,
    rating: 1,
    tags: ["vegan", "freezer-friendly", "budget"],
    categories: ["Lunch"],
    course: "Lunch",
    liked: false,
    totalDurationMinutes: 30,
  },
];

export function normalizeStarRating(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(5, Math.max(1, Math.round(value)));
}

export function mapRecipeToCardItem(recipe: MockRecipeRecord): RecipeCardItem {
  return {
    ...recipe,
    rating: normalizeStarRating(recipe.rating),
  };
}

export const MOBILE_HOME_RECIPE_CARDS: RecipeCardItem[] =
  MOCK_HOME_RECIPES.map(mapRecipeToCardItem);
