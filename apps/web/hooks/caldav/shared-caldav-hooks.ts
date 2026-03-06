"use client";

import { createCaldavHooks } from "@norish/shared-react/hooks";
import { addToast } from "@heroui/react";

import { useTRPC } from "@/app/providers/trpc-provider";

export const sharedCaldavHooks = createCaldavHooks({
  useTRPC,
  useToastAdapter: () => ({
    showSyncCompleteToast: (totalSynced: number, totalFailed: number) => {
      addToast({
        title: "CalDAV Sync Complete",
        description: `Synced ${totalSynced} items${totalFailed > 0 ? `, ${totalFailed} failed` : ""}`,
        color: totalFailed > 0 ? "warning" : "success",
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    },
  }),
});
