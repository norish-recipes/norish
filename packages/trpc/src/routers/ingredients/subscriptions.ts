import { ingredients } from "@norish/shared-server/realtime/ingredients";

import { realtimeSubscription } from "../../realtime-subscription";
import { router } from "../../trpc";

export const ingredientsSubscriptions = router({
  onChanged: realtimeSubscription(ingredients, "changed"),
});
