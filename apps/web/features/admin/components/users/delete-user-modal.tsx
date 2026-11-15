"use client";

import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
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
    <ConfirmModal
      confirm={
        <ActionButton action="delete" isPending={isDeleting} variant="danger" onPress={onConfirm}>
          {tActions("remove")}
        </ActionButton>
      }
      headerClassName="flex items-center gap-2"
      isCancelDisabled={isDeleting}
      isOpen={isOpen}
      title={
        <>
          <ExclamationTriangleIcon className="text-danger h-5 w-5" />
          {t("deleteTitle", { name: userName })}
        </>
      }
      onOpenChange={onClose}
    >
      <p>{t("deleteConfirm")}</p>
    </ConfirmModal>
  );
}
