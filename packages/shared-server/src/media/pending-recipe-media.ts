import { readdir } from "node:fs/promises";
import path from "node:path";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { getPublisherClient } from "@norish/shared-server/valkey/client";
import { mediaId } from "@norish/shared/lib/recipe-media";

const PREFIX = "norish:pending-recipe-media:";
/** As long as the nightly media cleanup leaves a recipe folder with no recipe. */
const TTL_SECONDS = 24 * 60 * 60;

async function hasFiles(recipeId: string): Promise<boolean> {
  const entries = await readdir(path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes", recipeId)).catch(
    () => []
  );

  return entries.length > 0;
}

/**
 * Whether the account may upload, create with or delete the files of a recipe id not stored yet.
 * Only the upload writing an id's first file claims it; files whose claim is gone are no one's.
 */
export async function mayUsePendingRecipeId(
  recipeId: string,
  userId: string,
  use: "upload" | "create" | "delete"
): Promise<boolean> {
  if (mediaId(recipeId) !== recipeId) return false;

  const valkey = await getPublisherClient();
  const key = `${PREFIX}${recipeId}`;
  const holder = await valkey.get(key);

  if (holder !== null) return holder === userId;
  if (use === "delete" || (await hasFiles(recipeId))) return false;
  if (use === "create") return true;

  const raced = await valkey.set(key, userId, "EX", TTL_SECONDS, "NX", "GET");

  return raced === null || raced === userId;
}

/** Gives back a claim whose upload wrote no file, so a rejected upload leaves no claim behind. */
export async function releasePendingRecipeId(recipeId: string, userId: string): Promise<void> {
  const valkey = await getPublisherClient();
  const key = `${PREFIX}${recipeId}`;

  if ((await valkey.get(key)) === userId && !(await hasFiles(recipeId))) await valkey.del(key);
}

/** The account that uploaded media for a recipe id not stored yet, if any. */
export async function pendingRecipeMediaUploader(recipeId: string): Promise<string | null> {
  const valkey = await getPublisherClient();

  return valkey.get(`${PREFIX}${recipeId}`);
}
