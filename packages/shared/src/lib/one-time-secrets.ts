/** Mutations whose answer is a secret shown once: an API key, a share link's URL. */
export const ONE_TIME_SECRET_PATHS: ReadonlySet<string> = new Set([
  "user.apiKeys.create",
  "recipes.shareCreate",
]);
