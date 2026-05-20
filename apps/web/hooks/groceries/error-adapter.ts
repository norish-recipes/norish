"use client";

import { useTranslations } from "next-intl";

import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";

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
