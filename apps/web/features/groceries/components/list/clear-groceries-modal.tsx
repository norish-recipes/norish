"use client";

import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
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
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <ConfirmModal
      confirm={
        <ActionButton action="delete" variant="danger" onPress={handleConfirm}>
          {t("confirm")}
        </ActionButton>
      }
      isOpen={isOpen}
      title={scopeName === null ? t("listTitle") : t("sectionTitle", { name: scopeName })}
      onOpenChange={onClose}
    >
      <p className="text-muted text-base">
        {scopeName === null
          ? t("listDescription", { count: itemCount })
          : t("sectionDescription", { name: scopeName, count: itemCount })}
      </p>
    </ConfirmModal>
  );
}
