"use client";

import type { ReactNode } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

type ConfirmModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  /** The button that confirms, beside Cancel. */
  confirm: ReactNode;
};

export default function ConfirmModal({
  isOpen,
  onOpenChange,
  title,
  children,
  confirm,
}: ConfirmModalProps) {
  const tActions = useTranslations("common.actions");

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog>
          {({ close }) => (
            <>
              <Modal.Header>{title}</Modal.Header>
              <Modal.Body>{children}</Modal.Body>
              <Modal.Footer>
                <ActionButtonGroup>
                  <ActionButton action="cancel" onPress={close}>
                    {tActions("cancel")}
                  </ActionButton>
                  {confirm}
                </ActionButtonGroup>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
