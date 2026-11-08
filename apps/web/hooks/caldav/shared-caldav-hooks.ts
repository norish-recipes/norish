"use client";

import { toast } from "@heroui/react";

import { createCaldavHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

// The hooks call this as a hook, so other platforms can use hooks in theirs; the web's needs none.
function toastAdapter() {
  return {
    showSyncCompleteToast: (totalQueued: number, totalFailed: number) => {
      toast("CalDAV Sync Started", {
        description: `Syncing ${totalQueued} items${totalFailed > 0 ? `, ${totalFailed} could not be queued` : ""}`,
        variant: totalFailed > 0 ? "warning" : "success",
      });
    },
  };
}

export const sharedCaldavHooks = createCaldavHooks({
  useTRPC,
  useToastAdapter: toastAdapter,
});
