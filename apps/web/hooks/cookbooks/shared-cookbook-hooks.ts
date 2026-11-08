"use client";

import { useUserContext } from "@/context/user-context";

import { createCookbookHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

export const sharedCookbookHooks = createCookbookHooks({
  useTRPC,
  // So a cookbook created Offline is shown as the reader's own rather than as
  // Orphaned, which would offer rename and delete to everyone (ADR-0027).
  useCurrentUserId: () => useUserContext().user?.id,
});
