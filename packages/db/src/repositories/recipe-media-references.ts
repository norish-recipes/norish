/** Thrown where a recipe's media row would point at a file another recipe holds. */
export class ForeignRecipeMediaError extends Error {
  constructor() {
    super("A recipe may only reference its own media files");
  }
}

const REMOTE = /^https?:\/\//i;

/** Whether `url` is remote or one of this recipe's files: `/recipes/{id}/{file}`, a step's under `steps/`. */
export function isOwnRecipeMedia(recipeId: string, url: string, place: "gallery" | "step"): boolean {
  if (REMOTE.test(url)) return true;
  const folder = place === "step" ? `/recipes/${recipeId}/steps/` : `/recipes/${recipeId}/`;

  return url.startsWith(folder) && /^[\w-]+\.\w+$/.test(url.slice(folder.length));
}

/** Throws unless every gallery image, video, thumbnail and step image named is this recipe's own. */
export function assertOwnRecipeMedia(
  recipeId: string,
  refs: {
    gallery?: ReadonlyArray<string | null | undefined>;
    steps?: ReadonlyArray<string | null | undefined>;
  }
): void {
  const own = (urls: ReadonlyArray<string | null | undefined> = [], place: "gallery" | "step") =>
    urls.every((url) => !url || isOwnRecipeMedia(recipeId, url, place));

  if (!own(refs.gallery, "gallery") || !own(refs.steps, "step")) {
    throw new ForeignRecipeMediaError();
  }
}
