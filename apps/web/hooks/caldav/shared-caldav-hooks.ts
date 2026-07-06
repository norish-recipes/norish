"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { toast } from "@heroui/react";

import { createCaldavHooks } from "@norish/shared-react/hooks";

export const sharedCaldavHooks = createCaldavHooks({
  useTRPC,
  useToastAdapter: () => ({
    showSyncCompleteToast: (totalSynced: number, totalFailed: number) => {
      toast("CalDAV Sync Complete", {
        description: `Synced ${totalSynced} items${totalFailed > 0 ? `, ${totalFailed} failed` : ""}`,
        variant: totalFailed > 0 ? "warning" : "success",
      });
    },
  }),
});
