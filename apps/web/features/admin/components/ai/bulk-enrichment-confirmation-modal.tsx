"use client";

import SettingsSwitch from "@/components/settings/settings-switch";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Note } from "@/components/shared/note";
import { ExclamationTriangleIcon, SparklesIcon } from "@heroicons/react/16/solid";
import { Modal } from "@heroui/react";
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
  const tActions = useTranslations("common.actions");

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          <Modal.Header className="flex items-center gap-2">
            <ExclamationTriangleIcon className="text-warning h-5 w-5" />
            {t("confirmTitle")}
          </Modal.Header>
          <Modal.Body>
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
          </Modal.Body>
          <Modal.Footer>
            <ActionButtonGroup>
              <ActionButton action="cancel" onPress={onClose}>
                {tActions("cancel")}
              </ActionButton>
              <ActionButton
                action="apply"
                icon={SparklesIcon}
                variant={replaceExisting ? "danger" : "secondary"}
                onPress={onConfirm}
              >
                {replaceExisting ? t("confirmButtonReplace") : t("confirmButton")}
              </ActionButton>
            </ActionButtonGroup>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
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
