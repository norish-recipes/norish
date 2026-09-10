"use client";

import { Button, Modal } from "@heroui/react";
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
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>{scopeName === null ? t("listTitle") : t("sectionTitle")}</Modal.Header>
          <Modal.Body>
            <p className="text-muted text-base">
              {scopeName === null
                ? t("listDescription", { count: itemCount })
                : t("sectionDescription", { name: scopeName, count: itemCount })}
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose}>
              {tActions("cancel")}
            </Button>
            <Button variant="danger" onPress={handleConfirm}>
              {t("confirm")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
