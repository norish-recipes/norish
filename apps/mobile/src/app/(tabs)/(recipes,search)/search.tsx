import React from "react";
import { RecipeResults } from "@/features/recipes/components/recipe-results";
import { SearchScreen } from "@/features/search/screens/search-screen";

export default function Search() {
  return <SearchScreen Results={RecipeResults} />;
}
