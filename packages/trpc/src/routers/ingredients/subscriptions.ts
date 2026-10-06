import { ingredients } from "@norish/shared-server/realtime/ingredients";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const ingredientsSubscriptions = router({
  onChanged: realtimeSubscription(ingredients, "changed"),
  onReview: realtimeSubscription(ingredients, "review"),
  onIcons: realtimeSubscription(ingredients, "icons"),
  onCorrected: realtimeSubscription(ingredients, "corrected"),
});
