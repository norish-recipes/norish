"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { Button, Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

type BulkEnrichmentConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};
export default function BulkEnrichmentConfirmationModal({
  isOpen,
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
            <div className="bg-warning/10 dark:bg-warning/10 border-warning/30 dark:border-warning/30 mt-2 rounded-lg border p-4">
              <p className="text-warning dark:text-warning text-base">{t("costWarning")}</p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose}>
              {tActions("cancel")}
            </Button>
            <Button variant="secondary" onPress={onConfirm}>
              {t("confirmButton")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
