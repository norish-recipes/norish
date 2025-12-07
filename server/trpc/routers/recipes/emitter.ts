import type { RecipeSubscriptionEvents } from "./types";

import { createTypedEmitter } from "../../emitter";

export const recipeEmitter = createTypedEmitter<RecipeSubscriptionEvents>();
