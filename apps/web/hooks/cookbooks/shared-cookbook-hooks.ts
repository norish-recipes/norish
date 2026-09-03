"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useUserContext } from "@/context/user-context";
import { useWarmSet } from "@/hooks/use-warm-set";

import { createCookbookHooks } from "@norish/shared-react/hooks";

export const sharedCookbookHooks = createCookbookHooks({
  useTRPC,
  // A cookbook made while Live joins the Warm Set now rather than at the next
  // warm, the same promise a newly created recipe gets (ADR-0008).
  usePromoteCreatedCookbook: () => useWarmSet().promoteCreatedCookbook,
  // So a cookbook created Offline is shown as the reader's own rather than as
  // Orphaned, which would offer rename and delete to everyone (ADR-0027).
  useCurrentUserId: () => useUserContext().user?.id,
});
