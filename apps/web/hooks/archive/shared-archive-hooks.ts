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

    return {
      showStartToast: (total: number) => {
        toast("Recipe import started", {
          description: `Importing ${total} recipes...`,
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
    return {
      showCompletionToast: (imported: number, notes: number, errors: number) => {
        const hasErrors = errors > 0;
        const hasNotes = notes > 0;

        let description: string;

        if (hasErrors && hasNotes) {
          description = `Imported ${imported} recipes, ${notes} with notes, ${errors} errors`;
        } else if (hasErrors) {
          description = `Imported ${imported} recipes with ${errors} errors`;
        } else if (hasNotes) {
          description = `Imported ${imported} recipes, ${notes} with notes`;
        } else {
          description = `Imported ${imported} recipes`;
        }

        toast("Recipe import complete", {
          description: description,
          variant: hasErrors ? "warning" : "success",
        });
      },
    };
  },
});
