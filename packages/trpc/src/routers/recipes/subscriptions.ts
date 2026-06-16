import { createEnvelopeAwareSubscription } from "../../helpers";
import { router } from "../../trpc";
import { recipeEmitter } from "./emitter";

const onCreated = createEnvelopeAwareSubscription(recipeEmitter, "created", "recipe created");
const onImportStarted = createEnvelopeAwareSubscription(
  recipeEmitter,
  "importStarted",
  "recipe import started"
);
const onImported = createEnvelopeAwareSubscription(recipeEmitter, "imported", "recipe imported");
const onUpdated = createEnvelopeAwareSubscription(recipeEmitter, "updated", "recipe updated");
const onDeleted = createEnvelopeAwareSubscription(recipeEmitter, "deleted", "recipe deleted");
const onConverted = createEnvelopeAwareSubscription(recipeEmitter, "converted", "recipe converted");
const onFailed = createEnvelopeAwareSubscription(recipeEmitter, "failed", "recipe failed");
const onShareCreated = createEnvelopeAwareSubscription(
  recipeEmitter,
  "shareCreated",
  "recipe share created"
);
const onShareUpdated = createEnvelopeAwareSubscription(
  recipeEmitter,
  "shareUpdated",
  "recipe share updated"
);
const onShareRevoked = createEnvelopeAwareSubscription(
  recipeEmitter,
  "shareRevoked",
  "recipe share revoked"
);
const onShareReactivated = createEnvelopeAwareSubscription(
  recipeEmitter,
  "shareReactivated",
  "recipe share reactivated"
);
const onShareDeleted = createEnvelopeAwareSubscription(
  recipeEmitter,
  "shareDeleted",
  "recipe share deleted"
);
const onNutritionStarted = createEnvelopeAwareSubscription(
  recipeEmitter,
  "nutritionStarted",
  "nutrition estimation started"
);
const onAutoTaggingStarted = createEnvelopeAwareSubscription(
  recipeEmitter,
  "autoTaggingStarted",
  "auto-tagging started"
);
const onAutoTaggingCompleted = createEnvelopeAwareSubscription(
  recipeEmitter,
  "autoTaggingCompleted",
  "auto-tagging completed"
);
const onAutoCategorizationStarted = createEnvelopeAwareSubscription(
  recipeEmitter,
  "autoCategorizationStarted",
  "auto-categorization started"
);
const onAutoCategorizationCompleted = createEnvelopeAwareSubscription(
  recipeEmitter,
  "autoCategorizationCompleted",
  "auto-categorization completed"
);
const onAllergyDetectionStarted = createEnvelopeAwareSubscription(
  recipeEmitter,
  "allergyDetectionStarted",
  "allergy detection started"
);
const onAllergyDetectionCompleted = createEnvelopeAwareSubscription(
  recipeEmitter,
  "allergyDetectionCompleted",
  "allergy detection completed"
);
const onProcessingToast = createEnvelopeAwareSubscription(
  recipeEmitter,
  "processingToast",
  "processing toast"
);
const onRecipeBatchCreated = createEnvelopeAwareSubscription(
  recipeEmitter,
  "recipeBatchCreated",
  "recipe batch created"
);

export const recipesSubscriptions = router({
  onCreated,
  onImportStarted,
  onImported,
  onUpdated,
  onDeleted,
  onConverted,
  onFailed,
  onShareCreated,
  onShareUpdated,
  onShareRevoked,
  onShareReactivated,
  onShareDeleted,
  onNutritionStarted,
  onAutoTaggingStarted,
  onAutoTaggingCompleted,
  onAutoCategorizationStarted,
  onAutoCategorizationCompleted,
  onAllergyDetectionStarted,
  onAllergyDetectionCompleted,
  onProcessingToast,
  onRecipeBatchCreated,
});
