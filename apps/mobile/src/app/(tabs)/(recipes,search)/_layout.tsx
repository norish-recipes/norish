import React from "react";
import { RecipesStack } from "@/features/recipes/components/recipes-stack";
import { SearchRoot } from "@/features/search/components/search-root";

// One folder, two stacks: Recipes and Search share the recipe's routes and its sheets, and each
// opens them inside its own stack. A link straight to a recipe or its cook mode has the tab's page under it.
export const unstable_settings = {
  recipes: { anchor: "index" },
  search: { anchor: "search" },
};

export default function Layout({ segment }: { segment: string }) {
  return <RecipesStack Provider={segment === "(search)" ? SearchRoot : undefined} />;
}
