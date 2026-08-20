"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { createArchiveHooks } from "@norish/shared-react/hooks";

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
  useSubscriptionToastAdapter: () => {
    const t = useTranslations("navbar.archiveImporter.toasts");

    return {
      showCompletionToast: (imported: number, notes: number, errors: number) => {
        // One message covers all four outcomes: the note and error clauses
        // drop out at zero rather than being assembled here.
        toast(t("completeTitle"), {
          description: t("completeDescription", { imported, notes, errors }),
          variant: errors > 0 ? "warning" : "success",
        });
      },
    };
  },
});
