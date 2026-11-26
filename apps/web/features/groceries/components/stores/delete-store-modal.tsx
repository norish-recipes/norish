"use client";

import { useState } from "react";
import { ActionButton } from "@/components/shared/action-button";
import {
  CancelButton,
  ModalFooter,
  ModalFrame,
  ModalTitle,
} from "@/components/shared/confirm-modal";
import { Modal, Radio, RadioGroup } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useStoreGroceryCount } from "@norish/shared-react/groceries";

interface DeleteStoreModalProps {
  isOpen: boolean;
  storeId: string | null;
  storeName: string;
  onClose: () => void;
  onConfirm: (storeId: string, deleteGroceries: boolean) => void;
}
export function DeleteStoreModal({
  isOpen,
  storeId,
  storeName,
  onClose,
  onConfirm,
}: DeleteStoreModalProps) {
  return (
    <ModalFrame isOpen={isOpen} onOpenChange={onClose}>
      <DeleteStoreDialog
        storeId={storeId}
        storeName={storeName}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </ModalFrame>
  );
}

/** The confirm's content, mounted only while the modal is open, so each opening starts on "keep". */
function DeleteStoreDialog({
  storeId,
  storeName,
  onClose,
  onConfirm,
}: Omit<DeleteStoreModalProps, "isOpen">) {
  const [deleteOption, setDeleteOption] = useState<"keep" | "delete">("keep");
  const t = useTranslations("groceries.storeManager");
  const itemCount = useStoreGroceryCount(storeId) ?? 0;

  const handleConfirm = () => {
    if (!storeId) return;
    onConfirm(storeId, deleteOption === "delete");
    onClose();
  };

  return (
    <>
      <ModalTitle>{t("deleteStore")}</ModalTitle>
      <Modal.Body className="gap-4">
        <p className="text-muted text-base">
          {t("confirmDelete", {
            storeName,
          })}
        </p>

        {itemCount > 0 && (
          <div>
            <p className="text-danger mb-3 text-sm font-medium">
              {itemCount === 1
                ? t("hasItems", {
                    count: itemCount,
                  })
                : t("hasItemsPlural", {
                    count: itemCount,
                  })}{" "}
              {t("whatToDo")}
            </p>

            <RadioGroup
              className="gap-3"
              value={deleteOption}
              onChange={(v) => setDeleteOption(v === "delete" ? "delete" : "keep")}
            >
              <Radio value="keep">
                <Radio.Content>
                  <div className="ml-1">
                    <p className="text-base font-medium">{t("keepItems")}</p>
                    <p className="text-muted text-xs">{t("keepItemsDescription")}</p>
                  </div>
                </Radio.Content>
              </Radio>
              <Radio value="delete">
                <Radio.Content>
                  <div className="ml-1">
                    <p className="text-base font-medium">{t("deleteItems")}</p>
                    <p className="text-muted text-xs">{t("deleteItemsDescription")}</p>
                  </div>
                </Radio.Content>
              </Radio>
            </RadioGroup>
          </div>
        )}

        {itemCount === 0 && <p className="text-muted text-sm">{t("noItems")}</p>}
      </Modal.Body>
      <ModalFooter start={<CancelButton onPress={onClose} />}>
        <ActionButton action="delete" variant="danger" onPress={handleConfirm}>
          {t("deleteStore")}
        </ActionButton>
      </ModalFooter>
    </>
  );
}
