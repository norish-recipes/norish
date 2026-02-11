"use client";

import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
} from "@heroui/react";
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
    <Modal
      classNames={{ wrapper: "z-[1100]", backdrop: "z-[1099]" }}
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader>{t("title")}</ModalHeader>
        <ModalBody>
          <p className="text-default-600 text-base">{t("confirmMessage")}</p>
          <div className="mt-4">
            <Switch isSelected={deleteEvents} onValueChange={setDeleteEvents}>
              <div>
                <p className="text-base font-medium">{t("deleteEventsLabel")}</p>
                <p className="text-default-500 text-xs">{t("deleteEventsDescription")}</p>
              </div>
            </Switch>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {tActions("cancel")}
          </Button>
          <Button color="danger" isLoading={deleting} onPress={handleConfirm}>
            {t("confirmButton")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
