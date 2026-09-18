import path from "node:path";

import { SERVER_CONFIG } from "@norish/config/env-config-server";

/** The web path Ingredient Illustrations are served under (ADR-0037). */
export const INGREDIENT_IMAGES_WEB_PREFIX = "/ingredient-images";

/** `<catalog ingredient id>-<stamp>.webp` — a new name for every picture (ADR-0021). */
export const INGREDIENT_IMAGE_FILENAME_PATTERN = /^[a-f0-9-]{36}-[a-z0-9]+\.webp$/;

/** Where Ingredient Illustrations live in uploads. */
export function getIngredientImagesDiskDir(): string {
  return path.join(SERVER_CONFIG.UPLOADS_DIR, "ingredient-images");
}
