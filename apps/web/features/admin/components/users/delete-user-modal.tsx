"use client";

import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

interface DeleteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName: string;
  isDeleting: boolean;
}

export function DeleteUserModal({
  isOpen,
  onClose,
  onConfirm,
  userName,
  isDeleting,
}: DeleteUserModalProps) {
  const t = useTranslations("settings.admin.users");
  const tActions = useTranslations("common.actions");

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          <Modal.Header className="flex items-center gap-2">
            <ExclamationTriangleIcon className="text-danger h-5 w-5" />
            {t("deleteTitle", { name: userName })}
          </Modal.Header>
          <Modal.Body>
            <p>{t("deleteConfirm")}</p>
          </Modal.Body>
          <Modal.Footer>
            <ActionButtonGroup>
              <ActionButton action="cancel" isDisabled={isDeleting} onPress={onClose}>
                {tActions("cancel")}
              </ActionButton>
              <ActionButton
                action="delete"
                isPending={isDeleting}
                variant="danger"
                onPress={onConfirm}
              >
                {tActions("remove")}
              </ActionButton>
            </ActionButtonGroup>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
