"use client";

import { useState } from "react";
import SettingsSwitch from "@/components/settings/settings-switch";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { usePending } from "@/hooks/use-pending";
import { Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

interface DeleteCaldavModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Resolves whether the config was deleted; the modal closes only then. */
  onConfirm: (deleteEvents: boolean) => Promise<boolean>;
}
export default function DeleteCaldavModal({ isOpen, onClose, onConfirm }: DeleteCaldavModalProps) {
  const t = useTranslations("settings.caldav.deleteModal");
  const tActions = useTranslations("common.actions");
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
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          <Modal.Header>{t("title")}</Modal.Header>
          <Modal.Body>
            <p className="text-muted text-base">{t("confirmMessage")}</p>
            <div className="mt-4">
              <SettingsSwitch isSelected={deleteEvents} onValueChange={setDeleteEvents}>
                <div>
                  <p className="text-base font-medium">{t("deleteEventsLabel")}</p>
                  <p className="text-muted text-xs">{t("deleteEventsDescription")}</p>
                </div>
              </SettingsSwitch>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <ActionButtonGroup>
              <ActionButton action="cancel" onPress={onClose}>
                {tActions("cancel")}
              </ActionButton>
              <ActionButton
                action="delete"
                isPending={deleting}
                variant="danger"
                onPress={handleConfirm}
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
