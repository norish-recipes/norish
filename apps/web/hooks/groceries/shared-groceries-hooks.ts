"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useUnitsQuery } from "@/hooks/config";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { useTranslations } from "next-intl";

import { createGroceriesHooks } from "@norish/shared-react/hooks";

export const sharedGroceriesHooks = createGroceriesHooks({
  useTRPC,
  useUnitsQuery,
  useErrorAdapter: () => {
    const tErrors = useTranslations("common.errors");

    return {
      showErrorToast: (reason: string) => {
        showSafeErrorToast({
          title: tErrors("operationFailed"),
          description: tErrors("technicalDetails"),
          error: reason,
          context: "groceries-subscription:onFailed",
        });
      },
    };
  },
});
