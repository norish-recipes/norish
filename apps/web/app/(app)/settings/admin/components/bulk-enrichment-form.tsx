"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { ActionButton } from "@/components/shared/action-button";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { SparklesIcon } from "@heroicons/react/16/solid";
import { toast } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useTranslations } from "next-intl";

import BulkEnrichmentConfirmationModal from "./bulk-enrichment-confirmation-modal";

export default function BulkEnrichmentForm() {
  const t = useTranslations("settings.admin.aiProcessing.bulkEnrichment");
  const tErrors = useTranslations("common.errors");
  const trpc = useTRPC();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  // Deliberately not remembered between openings: overwriting the library is a
  // choice to make each time, not a setting that lies in wait.
  const [replaceExisting, setReplaceExisting] = useState(false);
  // A per-request read, fetched as the confirmation opens: how many images
  // the sweep would generate, for the modal to name before it starts.
  const imageCountQuery = useQuery(
    trpc.admin.imageGenerationSweepCount.queryOptions(undefined, {
      enabled: isConfirmOpen,
      refetchOnMount: "always",
    })
  );
  const enrichAllMutation = useMutation(
    trpc.admin.enrichAllRecipes.mutationOptions({
      onError: (error) => {
        if (error instanceof TRPCClientError && error.data?.code === "PRECONDITION_FAILED") {
          toast(t("aiDisabled"), { variant: "warning" });

          return;
        }
        showSafeErrorToast({
          title: t("error"),
          description: tErrors("technicalDetails"),
          color: "danger",
          error,
          context: "admin-ai:enrich-all",
        });
      },
    })
  );
  const openConfirm = () => {
    setReplaceExisting(false);
    setIsConfirmOpen(true);
  };
  const handleConfirm = () => {
    setIsConfirmOpen(false);
    enrichAllMutation.mutate({ replaceExisting });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">{t("description")}</p>
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        {enrichAllMutation.isSuccess && (
          <span className="text-success text-sm">
            {t("queued", {
              recipes: enrichAllMutation.data.recipes,
              queued: enrichAllMutation.data.queued,
            })}
          </span>
        )}
        <ActionButton
          action="apply"
          icon={SparklesIcon}
          isPending={enrichAllMutation.isPending}
          variant="tertiary"
          onPress={openConfirm}
        >
          {t("button")}
        </ActionButton>
      </div>
      <BulkEnrichmentConfirmationModal
        imageCounts={imageCountQuery.data}
        isOpen={isConfirmOpen}
        replaceExisting={replaceExisting}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirm}
        onReplaceExistingChange={setReplaceExisting}
      />
    </div>
  );
}
