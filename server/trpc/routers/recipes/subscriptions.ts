import { router } from "../../trpc";
import { createPolicyAwareSubscription } from "../../helpers";

import { recipeEmitter } from "./emitter";

const onCreated = createPolicyAwareSubscription(recipeEmitter, "created", "recipe created");
const onImportStarted = createPolicyAwareSubscription(recipeEmitter, "importStarted", "recipe import started");
const onImported = createPolicyAwareSubscription(recipeEmitter, "imported", "recipe imported");
const onUpdated = createPolicyAwareSubscription(recipeEmitter, "updated", "recipe updated");
const onDeleted = createPolicyAwareSubscription(recipeEmitter, "deleted", "recipe deleted");
const onConverted = createPolicyAwareSubscription(recipeEmitter, "converted", "recipe converted");
const onFailed = createPolicyAwareSubscription(recipeEmitter, "failed", "recipe failed");
const onRecipeBatchCreated = createPolicyAwareSubscription(recipeEmitter, "recipeBatchCreated", "recipe batch created");

export const recipesSubscriptions = router({
  onCreated,
  onImportStarted,
  onImported,
  onUpdated,
  onDeleted,
  onConverted,
  onFailed,
  onRecipeBatchCreated,
});
