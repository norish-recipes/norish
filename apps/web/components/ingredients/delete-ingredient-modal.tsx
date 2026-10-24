"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { Button, Modal } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

const DELETE_TOUCHES = ["recipeLines", "groceries", "pantry"] as const;

/** Asks before an Ingredient goes, saying how many lines, groceries and pantry items it touches. */
export function DeleteIngredientModal({
  ingredientId,
  isOpen,
  name,
  onClose,
  onConfirm,
  onShowUses,
}: {
  ingredientId: string;
  isOpen: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
  onShowUses: () => void;
}) {
  const t = useTranslations("settings.ingredients");
  const tActions = useTranslations("common.actions");
  const trpc = useTRPC();
  const { data, isPending } = useQuery({
    ...trpc.ingredients.uses.queryOptions({ ingredientId }),
    enabled: isOpen,
  });
  const touched = DELETE_TOUCHES.filter((key) => (data?.counts[key] ?? 0) > 0);

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog data-testid="ingredient-delete-dialog">
          <Modal.Header className="flex items-center gap-2">
            <ExclamationTriangleIcon className="text-danger h-5 w-5" />
            {t("deleteTitle", { name })}
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3">
            <p>{t("deleteConfirm")}</p>
            {data && touched.length > 0 ? (
              <div className="flex flex-col items-start gap-2">
                <ul
                  className="text-muted list-disc pl-5 text-sm"
                  data-testid="ingredient-delete-touches"
                >
                  {touched.map((key) => (
                    <li key={key}>{t(`deleteTouches.${key}`, { count: data.counts[key] })}</li>
                  ))}
                </ul>
                <Button size="sm" variant="tertiary" onPress={onShowUses}>
                  {t("uses.show")}
                </Button>
              </div>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <ActionButtonGroup>
              <ActionButton action="cancel" onPress={onClose}>
                {tActions("cancel")}
              </ActionButton>
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
            </ActionButtonGroup>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
