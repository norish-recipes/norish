"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  RadioGroup,
  Radio,
} from "@heroui/react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

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
  const [deleteOption, setDeleteOption] = useState<"keep" | "delete">("keep");
  const trpc = useTRPC();
  const t = useTranslations("groceries.storeManager");
  const tActions = useTranslations("common.actions");

  // Fetch grocery count for this store
  const { data: groceryCount } = useQuery({
    ...trpc.stores.getGroceryCount.queryOptions({ storeId: storeId ?? "" }),
    enabled: isOpen && !!storeId,
  });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDeleteOption("keep");
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!storeId) return;
    onConfirm(storeId, deleteOption === "delete");
    onClose();
  };

  const itemCount = groceryCount ?? 0;

  return (
    <Modal
      classNames={{ wrapper: "z-[1100]", backdrop: "z-[1099]" }}
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader>{t("deleteStore")}</ModalHeader>
        <ModalBody className="gap-4">
          <p className="text-default-600 text-base">{t("confirmDelete", { storeName })}</p>

          {itemCount > 0 && (
            <div>
              <p className="text-danger mb-3 text-sm font-medium">
                {itemCount === 1
                  ? t("hasItems", { count: itemCount })
                  : t("hasItemsPlural", { count: itemCount })}{" "}
                {t("whatToDo")}
              </p>

              <RadioGroup
                classNames={{ wrapper: "gap-3" }}
                value={deleteOption}
                onValueChange={(v) => setDeleteOption(v as "keep" | "delete")}
              >
                <Radio value="keep">
                  <div className="ml-1">
                    <p className="text-base font-medium">{t("keepItems")}</p>
                    <p className="text-default-500 text-xs">{t("keepItemsDescription")}</p>
                  </div>
                </Radio>
                <Radio value="delete">
                  <div className="ml-1">
                    <p className="text-base font-medium">{t("deleteItems")}</p>
                    <p className="text-default-500 text-xs">{t("deleteItemsDescription")}</p>
                  </div>
                </Radio>
              </RadioGroup>
            </div>
          )}

          {itemCount === 0 && <p className="text-default-500 text-sm">{t("noItems")}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {tActions("cancel")}
          </Button>
          <Button color="danger" onPress={handleConfirm}>
            {t("deleteStore")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
