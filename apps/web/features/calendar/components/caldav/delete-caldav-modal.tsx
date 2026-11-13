"use client";

import { useState } from "react";
import SettingsSwitch from "@/components/settings/settings-switch";
import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { usePending } from "@/hooks/use-pending";
import { useTranslations } from "next-intl";

interface DeleteCaldavModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Resolves whether the config was deleted; the modal closes only then. */
  onConfirm: (deleteEvents: boolean) => Promise<boolean>;
}
export default function DeleteCaldavModal({ isOpen, onClose, onConfirm }: DeleteCaldavModalProps) {
  const t = useTranslations("settings.caldav.deleteModal");
  const [deleteEvents, setDeleteEvents] = useState(false);
  const [deleting, whileDeleting] = usePending();
  const handleConfirm = async () => {
    await whileDeleting(() =>
      onConfirm(deleteEvents).then((deleted) => {
        if (!deleted) return;
        setDeleteEvents(false);
        onClose();
      })
    );
  };

  return (
    <ConfirmModal
      confirm={
        <ActionButton action="delete" isPending={deleting} variant="danger" onPress={handleConfirm}>
          {t("confirmButton")}
        </ActionButton>
      }
      isOpen={isOpen}
      title={t("title")}
      onOpenChange={onClose}
    >
      <p className="text-muted text-base">{t("confirmMessage")}</p>
      <div className="mt-4">
        <SettingsSwitch isSelected={deleteEvents} onValueChange={setDeleteEvents}>
          <div>
            <p className="text-base font-medium">{t("deleteEventsLabel")}</p>
            <p className="text-muted text-xs">{t("deleteEventsDescription")}</p>
          </div>
        </SettingsSwitch>
      </div>
    </ConfirmModal>
  );
}
