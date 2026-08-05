"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { Button, toast } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useTranslations } from "next-intl";

import BulkEnrichmentConfirmationModal from "./bulk-enrichment-confirmation-modal";

export default function BulkEnrichmentForm() {
  const t = useTranslations("settings.admin.aiProcessing.bulkEnrichment");
  const tErrors = useTranslations("common.errors");
  const trpc = useTRPC();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
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
  const handleConfirm = () => {
    setIsConfirmOpen(false);
    enrichAllMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">{t("description")}</p>
      <div className="flex items-center justify-end gap-4">
        {enrichAllMutation.isSuccess && (
          <span className="text-success text-sm">
            {t("queued", {
              recipes: enrichAllMutation.data.recipes,
              queued: enrichAllMutation.data.queued,
            })}
          </span>
        )}
        <Button
          isPending={enrichAllMutation.isPending}
          variant="tertiary"
          onPress={() => setIsConfirmOpen(true)}
        >
          {t("button")}
        </Button>
      </div>
      <BulkEnrichmentConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
