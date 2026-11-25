import { getPublisherClient } from "@norish/shared-server/valkey/client";

const PREFIX = "norish:pending-recipe-media:";
/** As long as the nightly media cleanup leaves a recipe folder with no recipe. */
const TTL_SECONDS = 24 * 60 * 60;

/**
 * Claims a not yet stored recipe id for the account uploading its media; whether the claim is
 * theirs. The first account to upload for an id holds it.
 */
export async function claimPendingRecipeMedia(recipeId: string, userId: string): Promise<boolean> {
  const valkey = await getPublisherClient();
  const holder = await valkey.set(`${PREFIX}${recipeId}`, userId, "EX", TTL_SECONDS, "NX", "GET");

  return holder === null || holder === userId;
}

/** The account that uploaded media for a recipe id not stored yet, if any. */
export async function pendingRecipeMediaUploader(recipeId: string): Promise<string | null> {
  const valkey = await getPublisherClient();

  return valkey.get(`${PREFIX}${recipeId}`);
}
