"use client";

import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * Asks, as a spelling is removed by hand, whether its text names no food: "Not a food" stages the
 * removal for the junk pile, "Just remove" a plain one, and closing stages nothing.
 */
export function JunkSpellingModal({
  alias,
  onClose,
  onRemove,
}: {
  /** The spelling asked about; null keeps the modal closed. */
  alias: string | null;
  onClose: () => void;
  onRemove: (asJunk: boolean) => void;
}) {
  const t = useTranslations("settings.ingredients");

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={alias !== null} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog data-testid="ingredient-junk-dialog">
          <Modal.CloseTrigger />
          <Modal.Header>{t("junkTitle", { alias: alias ?? "" })}</Modal.Header>
          <Modal.Body>
            <p>{t("junkBody")}</p>
          </Modal.Body>
          <Modal.Footer>
            <ActionButtonGroup>
              <ActionButton
                action="remove"
                data-testid="ingredient-junk-remove"
                onPress={() => onRemove(false)}
              >
                {t("junkRemove")}
              </ActionButton>
              <ActionButton
                action="delete"
                data-testid="ingredient-junk-mark"
                onPress={() => onRemove(true)}
              >
                {t("junkMark")}
              </ActionButton>
            </ActionButtonGroup>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
