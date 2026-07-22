"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { Button, Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

type RestartConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};
export default function RestartConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
}: RestartConfirmationModalProps) {
  const t = useTranslations("settings.admin.restart");
  const tActions = useTranslations("common.actions");
  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          <Modal.Header className="flex items-center gap-2">
            <ExclamationTriangleIcon className="text-warning h-5 w-5" />
            {t("title")}
          </Modal.Header>
          <Modal.Body>
            <p>{t("confirmMessage")}</p>
            <div className="bg-warning/10 dark:bg-warning/10 border-warning/30 dark:border-warning/30 mt-2 rounded-lg border p-4">
              <p className="text-warning dark:text-warning text-base font-medium">
                {t("importantTitle")}
              </p>
              <ul className="text-warning dark:text-warning mt-2 list-inside list-disc space-y-1 text-base">
                <li>{t("warning1")}</li>
                <li>{t("warning2")}</li>
                <li>
                  {t.rich("warning3", {
                    code: (chunks) => (
                      <code className="bg-warning/10 dark:bg-warning/20 rounded px-1">
                        {chunks}
                      </code>
                    ),
                  })}
                </li>
              </ul>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onPress={onClose} variant="tertiary">
              {tActions("cancel")}
            </Button>
            <Button onPress={onConfirm} variant="secondary">
              {t("confirmButton")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
