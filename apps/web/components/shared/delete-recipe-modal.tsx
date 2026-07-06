"use client";

import { Button, Modal } from "@heroui/react";
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
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          {({ close: onCloseCallback }) => (
            <>
              <Modal.Header className="text-danger">{t("title")}</Modal.Header>
              <Modal.Body>
                <p className="text-danger mb-2 font-semibold">{t("warning")}</p>
                <p>
                  {t("confirmMessage", {
                    recipeName,
                  })}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button onPress={onCloseCallback} variant="tertiary">
                  {tActions("cancel")}
                </Button>
                <Button onPress={onConfirm} variant="danger">
                  {tActions("delete")}
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
