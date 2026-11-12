"use client";

import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Note } from "@/components/shared/note";
import { ArrowPathIcon, ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { Modal } from "@heroui/react";
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
            <Note className="mt-2" status="warning" title={t("importantTitle")}>
              <ul className="list-inside list-disc space-y-1">
                <li>{t("warning1")}</li>
                <li>{t("warning2")}</li>
                <li>
                  {t.rich("warning3", {
                    code: (chunks) => <code className="bg-default rounded px-1">{chunks}</code>,
                  })}
                </li>
              </ul>
            </Note>
          </Modal.Body>
          <Modal.Footer>
            <ActionButtonGroup>
              <ActionButton action="cancel" onPress={onClose}>
                {tActions("cancel")}
              </ActionButton>
              <ActionButton
                action="apply"
                icon={ArrowPathIcon}
                variant="secondary"
                onPress={onConfirm}
              >
                {t("confirmButton")}
              </ActionButton>
            </ActionButtonGroup>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
