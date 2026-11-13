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
  headerClassName?: string;
  bodyClassName?: string;
  /** Holds Cancel while the confirmed write runs. */
  isCancelDisabled?: boolean;
  "data-testid"?: string;
};

export default function ConfirmModal({
  isOpen,
  onOpenChange,
  title,
  children,
  confirm,
  headerClassName,
  bodyClassName,
  isCancelDisabled,
  "data-testid": testId,
}: ConfirmModalProps) {
  const tActions = useTranslations("common.actions");

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog data-testid={testId}>
          {({ close }) => (
            <>
              <Modal.Header className={headerClassName}>{title}</Modal.Header>
              <Modal.Body className={bodyClassName}>{children}</Modal.Body>
              <Modal.Footer>
                <ActionButtonGroup>
                  <ActionButton action="cancel" isDisabled={isCancelDisabled} onPress={close}>
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
