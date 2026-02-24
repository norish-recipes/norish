import { trpcLogger as log } from "@norish/api/logger";

import type { PermissionsSubscriptionEvents } from "./types";
import { createSubscriptionIterable, mergeAsyncIterables } from "../../helpers";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { permissionsEmitter } from "./emitter";

const onPolicyUpdated = authedProcedure.subscription(async function* ({ ctx, signal }) {
  // Listen to both broadcast events (admin changes policy) AND user-specific events
  // (e.g., user kicked from household, their recipe access changes)
  const broadcastEventName = permissionsEmitter.broadcastEvent("policyUpdated");
  const userEventName = permissionsEmitter.userEvent(ctx.user.id, "policyUpdated");

  log.trace({ userId: ctx.user.id }, "Subscribed to permission policy updates");

  try {
    // Merge both event sources
    const broadcastIterable = createSubscriptionIterable(
      permissionsEmitter,
      ctx.multiplexer,
      broadcastEventName,
      signal
    );
    const userIterable = createSubscriptionIterable(
      permissionsEmitter,
      ctx.multiplexer,
      userEventName,
      signal
    );

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
