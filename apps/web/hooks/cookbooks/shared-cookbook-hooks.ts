"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useUserContext } from "@/context/user-context";

import { createCookbookHooks } from "@norish/shared-react/hooks";

export const sharedCookbookHooks = createCookbookHooks({
  useTRPC,
  // So a cookbook created Offline is shown as the reader's own rather than as
  // Orphaned, which would offer rename and delete to everyone (ADR-0027).
  useCurrentUserId: () => useUserContext().user?.id,
});
