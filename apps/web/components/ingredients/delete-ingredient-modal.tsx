"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { Button, Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * Asks before an Ingredient goes: its spellings go with it, and what the
 * household taught Norish about it. An Ingredient something still uses is
 * refused by the server, so this only confirms the intent.
 */
export function DeleteIngredientModal({
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
  const t = useTranslations("settings.ingredients");
  const tActions = useTranslations("common.actions");

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog data-testid="ingredient-delete-dialog">
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
            <Button data-testid="ingredient-delete-confirm" variant="danger" onPress={onConfirm}>
              {tActions("delete")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
