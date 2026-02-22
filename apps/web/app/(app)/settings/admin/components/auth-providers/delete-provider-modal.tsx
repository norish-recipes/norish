"use client";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
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
    <Modal
      classNames={{ wrapper: "z-[1100]", backdrop: "z-[1099]" }}
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <ExclamationTriangleIcon className="text-danger h-5 w-5" />
          {t("removeTitle", { provider: providerName })}
        </ModalHeader>
        <ModalBody>
          <p>{t("removeConfirm")}</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            {tActions("cancel")}
          </Button>
          <Button color="danger" onPress={onConfirm}>
            {tActions("remove")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
