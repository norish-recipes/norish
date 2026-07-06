"use client";

import { useState } from "react";
import SettingsSwitch from "@/app/(app)/settings/components/settings-switch";
import { Button, Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

interface DeleteCalDavModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteEvents: boolean) => Promise<void>;
}
export default function DeleteCalDavModal({ isOpen, onClose, onConfirm }: DeleteCalDavModalProps) {
  const t = useTranslations("settings.caldav.deleteModal");
  const tActions = useTranslations("common.actions");
  const [deleteEvents, setDeleteEvents] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm(deleteEvents);
      setDeleteEvents(false);
      onClose();
    } finally {
      setDeleting(false);
    }
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
            <Button onPress={onClose} variant="tertiary">
              {tActions("cancel")}
            </Button>
            <Button onPress={handleConfirm} variant="danger" isPending={deleting}>
              {t("confirmButton")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
