"use client";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { useTranslations } from "next-intl";

interface DeleteRecipeModalProps {
  isOpen: boolean;
  recipeName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteRecipeModal({
  isOpen,
  recipeName,
  onClose,
  onConfirm,
}: DeleteRecipeModalProps) {
  const t = useTranslations("recipes.deleteModal");
  const tActions = useTranslations("common.actions");

  return (
    <Modal
      classNames={{ wrapper: "z-[1100]", backdrop: "z-[1099]" }}
      isOpen={isOpen}
      onOpenChange={onClose}
    >
      <ModalContent>
        {(onCloseCallback) => (
          <>
            <ModalHeader className="text-danger">{t("title")}</ModalHeader>
            <ModalBody>
              <p className="text-danger mb-2 font-semibold">{t("warning")}</p>
              <p>{t("confirmMessage", { recipeName })}</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onCloseCallback}>
                {tActions("cancel")}
              </Button>
              <Button color="danger" onPress={onConfirm}>
                {tActions("delete")}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
