"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { addToast } from "@heroui/react";

import { createCaldavHooks } from "@norish/shared-react/hooks";

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
