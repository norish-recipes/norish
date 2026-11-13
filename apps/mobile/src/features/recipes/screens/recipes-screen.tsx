import React from "react";

import { LibraryList } from "../components/library-list";

/** The Recipes tab; Today sits above the Library as its list header when its ticket lands. */
export function RecipesScreen() {
  return <LibraryList testID="recipes-screen" />;
}
