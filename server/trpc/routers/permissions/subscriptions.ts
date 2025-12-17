import type { PermissionsSubscriptionEvents } from "./types";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";
import { mergeAsyncIterables } from "../../helpers";

import { permissionsEmitter } from "./emitter";

import { trpcLogger as log } from "@/server/logger";

const onPolicyUpdated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  // Listen to both broadcast events (admin changes policy) AND user-specific events
  // (e.g., user kicked from household, their recipe access changes)
  const broadcastEventName = permissionsEmitter.broadcastEvent("policyUpdated");
  const userEventName = permissionsEmitter.userEvent(ctx.user.id, "policyUpdated");

  log.trace({ userId: ctx.user.id }, "Subscribed to permission policy updates");

  try {
    // Merge both event sources
    const broadcastIterable = permissionsEmitter.createSubscription(broadcastEventName, signal);
    const userIterable = permissionsEmitter.createSubscription(userEventName, signal);

    for await (const data of mergeAsyncIterables([broadcastIterable, userIterable], signal)) {
      yield data as PermissionsSubscriptionEvents["policyUpdated"];
    }
  } finally {
    log.trace({ userId: ctx.user.id }, "Unsubscribed from permission policy updates");
  }
});

export const permissionsSubscriptions = router({
  onPolicyUpdated,
});
