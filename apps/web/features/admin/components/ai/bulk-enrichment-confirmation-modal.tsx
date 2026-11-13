"use client";

import SettingsSwitch from "@/components/settings/settings-switch";
import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { Note } from "@/components/shared/note";
import { ExclamationTriangleIcon, SparklesIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useImageGenerationSweepCount } from "@norish/shared-react/admin";

type BulkEnrichmentConfirmationModalProps = {
  isOpen: boolean;
  replaceExisting: boolean;
  onReplaceExistingChange: (replaceExisting: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
};
export default function BulkEnrichmentConfirmationModal({
  isOpen,
  replaceExisting,
  onReplaceExistingChange,
  onClose,
  onConfirm,
}: BulkEnrichmentConfirmationModalProps) {
  const t = useTranslations("settings.admin.aiProcessing.bulkEnrichment");

  return (
    <ConfirmModal
      confirm={
        <ActionButton
          action="apply"
          icon={SparklesIcon}
          variant={replaceExisting ? "danger" : "secondary"}
          onPress={onConfirm}
        >
          {replaceExisting ? t("confirmButtonReplace") : t("confirmButton")}
        </ActionButton>
      }
      headerClassName="flex items-center gap-2"
      isOpen={isOpen}
      title={
        <>
          <ExclamationTriangleIcon className="text-warning h-5 w-5" />
          {t("confirmTitle")}
        </>
      }
      onOpenChange={onClose}
    >
      <p>{t("confirmMessage")}</p>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{t("replaceExisting")}</span>
          <span className="text-muted text-base">{t("replaceExistingDescription")}</span>
        </div>
        <SettingsSwitch
          aria-label={t("replaceExisting")}
          isSelected={replaceExisting}
          onValueChange={onReplaceExistingChange}
        />
      </div>
      {replaceExisting && (
        <Note className="mt-2" status="danger">
          {t("replaceWarning")}
        </Note>
      )}
      <SweepImageCount replaceExisting={replaceExisting} />
      <Note className="mt-2" status="warning">
        {t("costWarning")}
      </Note>
    </ConfirmModal>
  );
}

/** How many images the sweep would draw, read as the confirmation opens; nothing while unknown or off. */
function SweepImageCount({ replaceExisting }: { replaceExisting: boolean }) {
  const t = useTranslations("settings.admin.aiProcessing.bulkEnrichment");
  const counts = useImageGenerationSweepCount();

  if (!counts?.enabled) return null;

  return (
    <p className="text-muted mt-2 text-base">
      {t("imageCount", { count: replaceExisting ? counts.overwrite : counts.gapOnly })}
    </p>
  );
}
