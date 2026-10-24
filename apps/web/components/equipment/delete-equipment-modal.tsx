"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { Button, Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

export function DeleteEquipmentModal({
  isOpen,
  name,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("settings.equipment");
  const tActions = useTranslations("common.actions");

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog data-testid="equipment-delete-dialog">
          <Modal.Header className="flex items-center gap-2">
            <ExclamationTriangleIcon className="text-danger h-5 w-5" />
            {t("deleteTitle", { name })}
          </Modal.Header>
          <Modal.Body>
            <p>{t("deleteConfirm")}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose}>
              {tActions("cancel")}
            </Button>
            <Button data-testid="equipment-delete-confirm" variant="danger" onPress={onConfirm}>
              {tActions("delete")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
