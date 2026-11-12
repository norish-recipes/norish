"use client";

import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
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
    <ConfirmModal
      confirm={
        <ActionButton action="delete" variant="danger" onPress={onConfirm}>
          {tActions("remove")}
        </ActionButton>
      }
      headerClassName="flex items-center gap-2"
      isOpen={isOpen}
      title={
        <>
          <ExclamationTriangleIcon className="text-danger h-5 w-5" />
          {t("removeTitle", {
            provider: providerName,
          })}
        </>
      }
      onOpenChange={onClose}
    >
      <p>{t("removeConfirm")}</p>
    </ConfirmModal>
  );
}
