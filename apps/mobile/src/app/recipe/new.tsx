import React from "react";
import { RecipeEditorScreen } from "@/features/recipe/screens/recipe-editor-screen";

/** Write it yourself: the editor on an empty recipe. */
export default function NewRecipeRoute() {
  return <RecipeEditorScreen mode="create" />;
}
