"use client";

import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { createArchiveHooks } from "@norish/shared-react/hooks";
import { useTRPC } from "@norish/shared-react/trpc";

export const sharedArchiveHooks = createArchiveHooks({
  useTRPC,
  useMutationToastAdapter: () => {
    const tErrors = useTranslations("common.errors");
    const t = useTranslations("navbar.archiveImporter.toasts");

    return {
      showStartToast: (total: number) => {
        toast(t("startTitle"), {
          description: t("startDescription", { count: total }),
          variant: "default",
        });
      },
      showErrorToast: (error: unknown) => {
        showSafeErrorToast({
          title: tErrors("operationFailed"),
          description: tErrors("technicalDetails"),
          error,
          context: "archive-import:start",
        });
      },
    };
  },
});
