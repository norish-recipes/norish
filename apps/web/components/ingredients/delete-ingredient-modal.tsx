"use client";

import { ActionButton } from "@/components/shared/action-button";
import {
  CancelButton,
  ModalFooter,
  ModalFrame,
  ModalTitle,
} from "@/components/shared/confirm-modal";
import { ExclamationTriangleIcon, EyeIcon } from "@heroicons/react/16/solid";
import { Button, Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

import { DELETE_TOUCHES, useIngredientUseCounts } from "@norish/shared-react/ingredients";

/** Asks before an Ingredient goes, saying how many lines, groceries and pantry items it touches. */
export function DeleteIngredientModal({
  isOpen,
  onClose,
  ...content
}: {
  ingredientId: string;
  isOpen: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
  onShowUses: () => void;
}) {
  return (
    <ModalFrame data-testid="ingredient-delete-dialog" isOpen={isOpen} onOpenChange={onClose}>
      <DeleteIngredientContent onClose={onClose} {...content} />
    </ModalFrame>
  );
}

/** The dialog's content, mounted while it is open, so the uses are read only then. */
function DeleteIngredientContent({
  ingredientId,
  name,
  onClose,
  onConfirm,
  onShowUses,
}: {
  ingredientId: string;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
  onShowUses: () => void;
}) {
  const t = useTranslations("settings.ingredients");
  const tActions = useTranslations("common.actions");
  const { counts, isPending } = useIngredientUseCounts(ingredientId);
  const touched = DELETE_TOUCHES.filter((key) => (counts?.[key] ?? 0) > 0);

  return (
    <>
      <ModalTitle>
        <ExclamationTriangleIcon className="text-danger h-5 w-5" />
        {t("deleteTitle", { name })}
      </ModalTitle>
      <Modal.Body className="flex flex-col gap-3">
        <p>{t("deleteConfirm")}</p>
        {counts && touched.length > 0 ? (
          <div className="flex flex-col items-start gap-2">
            <ul
              className="text-muted list-disc pl-5 text-sm"
              data-testid="ingredient-delete-touches"
            >
              {touched.map((key) => (
                <li key={key}>{t(`deleteTouches.${key}`, { count: counts[key] })}</li>
              ))}
            </ul>
            <Button size="sm" variant="tertiary" onPress={onShowUses}>
              <EyeIcon className="size-4" />
              {t("uses.show")}
            </Button>
          </div>
        ) : null}
      </Modal.Body>
      <ModalFooter start={<CancelButton onPress={onClose} />}>
        <ActionButton
          action="delete"
          data-testid="ingredient-delete-confirm"
          // Not before the counts are read; a failed read leaves it open.
          isDisabled={isPending}
          variant="danger"
          onPress={onConfirm}
        >
          {tActions("delete")}
        </ActionButton>
      </ModalFooter>
    </>
  );
}
