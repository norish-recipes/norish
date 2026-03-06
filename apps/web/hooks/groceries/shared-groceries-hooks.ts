"use client";

import { createGroceriesHooks } from "@norish/shared-react/hooks";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useUnitsQuery } from "@/hooks/config";
import { showSafeErrorToast } from "@norish/shared/lib/ui/safe-error-toast";

export const sharedGroceriesHooks = createGroceriesHooks({
  useTRPC,
  useUnitsQuery,
  useErrorAdapter: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
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
