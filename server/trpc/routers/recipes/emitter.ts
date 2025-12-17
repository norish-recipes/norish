import type { RecipeSubscriptionEvents } from "./types";

import { createTypedEmitter, TypedEmitter } from "../../emitter";

// Use globalThis to persist across HMR in development
declare global {
  var __recipeEmitter__: TypedEmitter<RecipeSubscriptionEvents> | undefined;
}

export const recipeEmitter =
  globalThis.__recipeEmitter__ ||
  (globalThis.__recipeEmitter__ = createTypedEmitter<RecipeSubscriptionEvents>("recipe"));
