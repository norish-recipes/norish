"use client";

import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

interface ClearGroceriesModalProps {
  isOpen: boolean;
  itemCount: number;
  /** null clears the whole list; otherwise the Store's, Unsorted's or a recipe's name. */
  scopeName: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ClearGroceriesModal({
  isOpen,
  itemCount,
  scopeName,
  onClose,
  onConfirm,
}: ClearGroceriesModalProps) {
  const t = useTranslations("groceries.clearConfirm");
  const tActions = useTranslations("common.actions");
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          <Modal.Header>
            {scopeName === null ? t("listTitle") : t("sectionTitle", { name: scopeName })}
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted text-base">
              {scopeName === null
                ? t("listDescription", { count: itemCount })
                : t("sectionDescription", { name: scopeName, count: itemCount })}
            </p>
          </Modal.Body>
          <Modal.Footer>
            <ActionButtonGroup>
              <ActionButton action="cancel" onPress={onClose}>
                {tActions("cancel")}
              </ActionButton>
              <ActionButton action="delete" variant="danger" onPress={handleConfirm}>
                {t("confirm")}
              </ActionButton>
            </ActionButtonGroup>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
