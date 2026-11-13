"use client";

import { createClientLogger } from "@norish/shared/lib/logger";
import { isQueuedOutboxSignal } from "@norish/shared/lib/trpc-errors";

import type { RecipesMutationErrorHandler } from "./recipes-mutation-error";
import { usePlatform } from "../platform";

const log = createClientLogger("recipes-mutations");

/**
 * The toast a failed recipe write shows. A write the Outbox captured is saved, not failed:
 * it says so as a warning; anything else is a generic failure, never the backend's message, under `titleId`.
 */
export function useRecipeMutationErrorToast(titleId = "common.errors.operationFailed"): RecipesMutationErrorHandler {
  const { toast } = usePlatform();

  return (error, operation) => {
    if (isQueuedOutboxSignal(error)) {
      toast.show({
        severity: "warning",
        title: toast.translate("common.queuedOffline.title"),
        description: toast.translate("common.queuedOffline.description"),
      });

      return;
    }

    log.error({ error }, `recipes-mutations:${operation}`);
    toast.show({
      severity: "default",
      title: toast.translate(titleId),
      description: toast.translate("common.errors.technicalDetails"),
    });
  };
}
