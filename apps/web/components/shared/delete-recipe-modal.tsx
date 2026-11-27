"use client";

import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { useTranslations } from "next-intl";

interface DeleteRecipeModalProps {
  isOpen: boolean;
  /** One recipe is named; several are counted. */
  recipeName?: string;
  count?: number;
  /** Selected recipes the reader may not delete, which stay. */
  keptCount?: number;
  onClose: () => void;
  onConfirm: () => void;
}
export function DeleteRecipeModal({
  isOpen,
  recipeName,
  count = 1,
  keptCount = 0,
  onClose,
  onConfirm,
}: DeleteRecipeModalProps) {
  const t = useTranslations("recipes.deleteModal");
  const tActions = useTranslations("common.actions");

  return (
    <ConfirmModal
      confirm={
        <ActionButton action="delete" variant="danger" onPress={onConfirm}>
          {tActions("delete")}
        </ActionButton>
      }
      danger
      isOpen={isOpen}
      title={t("title")}
      onOpenChange={onClose}
    >
      <p className="text-danger mb-2 font-semibold">{t("warning")}</p>
      <p>{recipeName ? t("confirmMessage", { recipeName }) : t("confirmCount", { count })}</p>
      {keptCount > 0 ? <p className="mt-2">{t("keptCount", { count: keptCount })}</p> : null}
    </ConfirmModal>
  );
}
