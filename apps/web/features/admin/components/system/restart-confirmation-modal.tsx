"use client";

import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { Note } from "@/components/shared/note";
import { ArrowPathIcon, ExclamationTriangleIcon } from "@heroicons/react/16/solid";
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
  return (
    <ConfirmModal
      confirm={
        <ActionButton action="apply" icon={ArrowPathIcon} variant="secondary" onPress={onConfirm}>
          {t("confirmButton")}
        </ActionButton>
      }
      headerClassName="flex items-center gap-2"
      isOpen={isOpen}
      title={
        <>
          <ExclamationTriangleIcon className="text-warning h-5 w-5" />
          {t("title")}
        </>
      }
      onOpenChange={onClose}
    >
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
    </ConfirmModal>
  );
}
