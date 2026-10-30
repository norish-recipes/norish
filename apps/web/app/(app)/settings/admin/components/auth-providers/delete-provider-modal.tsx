"use client";

import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

interface DeleteProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  providerName: string;
}
export function DeleteProviderModal({
  isOpen,
  onClose,
  onConfirm,
  providerName,
}: DeleteProviderModalProps) {
  const t = useTranslations("settings.admin.authProviders.form");
  const tActions = useTranslations("common.actions");
  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          <Modal.Header className="flex items-center gap-2">
            <ExclamationTriangleIcon className="text-danger h-5 w-5" />
            {t("removeTitle", {
              provider: providerName,
            })}
          </Modal.Header>
          <Modal.Body>
            <p>{t("removeConfirm")}</p>
          </Modal.Body>
          <Modal.Footer>
            <ActionButtonGroup>
              <ActionButton action="cancel" onPress={onClose}>
                {tActions("cancel")}
              </ActionButton>
              <ActionButton action="delete" variant="danger" onPress={onConfirm}>
                {tActions("remove")}
              </ActionButton>
            </ActionButtonGroup>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
