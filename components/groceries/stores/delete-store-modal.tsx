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

import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

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
        <ModalHeader>Delete Store</ModalHeader>
        <ModalBody className="gap-4">
          <p className="text-default-600 text-base">
            Are you sure you want to delete <span className="font-semibold">{storeName}</span>?
          </p>

          {itemCount > 0 && (
            <div>
              <p className="text-danger mb-3 text-sm font-medium">
                This store has {itemCount} grocery item{itemCount !== 1 ? "s" : ""}.
                What would you like to do with them?
              </p>

              <RadioGroup
                classNames={{ wrapper: "gap-3" }}
                value={deleteOption}
                onValueChange={(v) => setDeleteOption(v as "keep" | "delete")}
              >
                <Radio value="keep">
                  <div className="ml-1">
                    <p className="text-base font-medium">Keep items</p>
                    <p className="text-default-500 text-xs">Move items to Unsorted</p>
                  </div>
                </Radio>
                <Radio value="delete">
                  <div className="ml-1">
                    <p className="text-base font-medium">Delete items</p>
                    <p className="text-default-500 text-xs">Remove all items in this store</p>
                  </div>
                </Radio>
              </RadioGroup>
            </div>
          )}

          {itemCount === 0 && (
            <p className="text-default-500 text-sm">This store has no items.</p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button color="danger" onPress={handleConfirm}>
            Delete Store
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
