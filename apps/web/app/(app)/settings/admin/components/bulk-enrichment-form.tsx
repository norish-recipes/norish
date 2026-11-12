"use client";

import { useState } from "react";
import { ActionButton } from "@/components/shared/action-button";
import { SparklesIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useEnrichAllRecipes } from "@norish/shared-react/admin";

import BulkEnrichmentConfirmationModal from "./bulk-enrichment-confirmation-modal";

export default function BulkEnrichmentForm() {
  const t = useTranslations("settings.admin.aiProcessing.bulkEnrichment");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  // Deliberately not remembered between openings: overwriting the library is a
  // choice to make each time, not a setting that lies in wait.
  const [replaceExisting, setReplaceExisting] = useState(false);
  const { enrichAll, queued, isPending } = useEnrichAllRecipes();
  const openConfirm = () => {
    setReplaceExisting(false);
    setIsConfirmOpen(true);
  };
  const handleConfirm = () => {
    setIsConfirmOpen(false);
    enrichAll(replaceExisting);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">{t("description")}</p>
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        {queued && (
          <span className="text-success text-sm">
            {t("queued", { recipes: queued.recipes, queued: queued.queued })}
          </span>
        )}
        <ActionButton
          action="apply"
          icon={SparklesIcon}
          isPending={isPending}
          variant="tertiary"
          onPress={openConfirm}
        >
          {t("button")}
        </ActionButton>
      </div>
      <BulkEnrichmentConfirmationModal
        isOpen={isConfirmOpen}
        replaceExisting={replaceExisting}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirm}
        onReplaceExistingChange={setReplaceExisting}
      />
    </div>
  );
}
