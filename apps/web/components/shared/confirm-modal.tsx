"use client";

import type { ReactNode } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

type ModalFooterProps = {
  /** Puts Cancel at the start; `start` wins where a modal has its own way out. */
  onCancel?: () => void;
  /** Holds Cancel while the confirmed write runs. */
  isCancelDisabled?: boolean;
  /** The way out or destructive action, pinned left. */
  start?: ReactNode;
  /** The primary, last, at the right end. */
  children: ReactNode;
};

/** Every modal's footer: the way out on the left, the primary on the right. */
export function ModalFooter({ onCancel, isCancelDisabled, start, children }: ModalFooterProps) {
  const tActions = useTranslations("common.actions");

  return (
    <Modal.Footer>
      <ActionButtonGroup
        start={
          start ??
          (onCancel ? (
            <ActionButton action="cancel" isDisabled={isCancelDisabled} onPress={onCancel}>
              {tActions("cancel")}
            </ActionButton>
          ) : null)
        }
      >
        {children}
      </ActionButtonGroup>
    </Modal.Footer>
  );
}

type ConfirmModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  /** The primary button, at the right end opposite Cancel. */
  confirm: ReactNode;
  size?: "sm" | "md" | "lg";
  headerClassName?: string;
  bodyClassName?: string;
  isCancelDisabled?: boolean;
  "data-testid"?: string;
};

/** The modal template: a title, the content, and a `ModalFooter` with Cancel and the primary. */
export default function ConfirmModal({
  isOpen,
  onOpenChange,
  title,
  children,
  confirm,
  size,
  headerClassName,
  bodyClassName,
  isCancelDisabled,
  "data-testid": testId,
}: ConfirmModalProps) {
  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="z-[1100]" size={size}>
        <Modal.Dialog data-testid={testId}>
          {({ close }) => (
            <>
              <Modal.Header className={headerClassName}>{title}</Modal.Header>
              <Modal.Body className={bodyClassName}>{children}</Modal.Body>
              <ModalFooter isCancelDisabled={isCancelDisabled} onCancel={close}>
                {confirm}
              </ModalFooter>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
