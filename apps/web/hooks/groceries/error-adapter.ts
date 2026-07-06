"use client";

import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { useTranslations } from "next-intl";

export function useGroceriesErrorAdapter() {
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
}
