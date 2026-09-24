import { recipes } from "@norish/shared-server/realtime/recipes";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const recipesSubscriptions = router({
  onCreated: realtimeSubscription(recipes, "created"),
  onImportStarted: realtimeSubscription(recipes, "importStarted"),
  onImported: realtimeSubscription(recipes, "imported"),
  onUpdated: realtimeSubscription(recipes, "updated"),
  onDeleted: realtimeSubscription(recipes, "deleted"),
  onConverted: realtimeSubscription(recipes, "converted"),
  onFailed: realtimeSubscription(recipes, "failed"),
  onShareEvent: realtimeSubscription(recipes, "shareEvent"),
  onEnrichment: realtimeSubscription(recipes, "enrichment"),
  onRecipeBatchCreated: realtimeSubscription(recipes, "recipeBatchCreated"),
});
