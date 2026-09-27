"use client";

import { Button, Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

interface IngredientConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  /** Null when there is nothing to confirm, only something to read. */
  confirmLabel: string | null;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Confirms an ingredient delete or a batch of drawings, or says why a delete is refused. */
export function IngredientConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  danger = false,
  onClose,
  onConfirm,
}: IngredientConfirmModalProps) {
  const tActions = useTranslations("common.actions");

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          <Modal.Header>{title}</Modal.Header>
          <Modal.Body>
            <p className="text-muted text-base">{description}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose}>
              {confirmLabel ? tActions("cancel") : tActions("close")}
            </Button>
            {confirmLabel && (
              <Button
                data-testid="ingredients-confirm"
                variant={danger ? "danger" : "primary"}
                onPress={onConfirm}
              >
                {confirmLabel}
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
