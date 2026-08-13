"use client";

import { useEffect, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { Button, Modal, Radio, RadioGroup } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

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
    ...trpc.stores.getGroceryCount.queryOptions({
      storeId: storeId ?? "",
    }),
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
    // This confirm opens while the store-manager Panel is still up: z-* lifts it
    // above the drawer (z-[1001]), and pointer-events-auto opts back out of the
    // `pointer-events: none` vaul sets on <body>, which the portalled backdrop
    // inherits — without it every click in the modal is swallowed. It must stay
    // portalled to <body>: inside the drawer, vaul's transform would re-root
    // `position: fixed` and shrink the backdrop to the sheet's own box.
    <Modal.Backdrop className="pointer-events-auto z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          <Modal.Header>{t("deleteStore")}</Modal.Header>
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
                  onValueChange={(v) => setDeleteOption(v as "keep" | "delete")}
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
          <Modal.Footer>
            <Button variant="tertiary" onPress={onClose}>
              {tActions("cancel")}
            </Button>
            <Button variant="danger" onPress={handleConfirm}>
              {t("deleteStore")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
