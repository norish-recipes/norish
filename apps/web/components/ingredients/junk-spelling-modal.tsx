"use client";

import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
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
    <ConfirmModal
      confirm={
        <>
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
        </>
      }
      data-testid="ingredient-junk-dialog"
      isOpen={alias !== null}
      title={t("junkTitle", { alias: alias ?? "" })}
      onOpenChange={onClose}
    >
      <p>{t("junkBody")}</p>
    </ConfirmModal>
  );
}
