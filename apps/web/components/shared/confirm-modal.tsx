"use client";

import type { ReactNode } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Modal } from "@heroui/react";
import { useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

type ModalFooterProps = {
  /** The way out and any destructive action, pinned at the start. */
  start?: ReactNode;
  /** The primary, last, at the end. */
  children: ReactNode;
};

/** Every modal's footer: the way out on the left, the primary on the right. */
export function ModalFooter({ start, children }: ModalFooterProps) {
  return (
    <Modal.Footer>
      <ActionButtonGroup start={start}>{children}</ActionButtonGroup>
    </Modal.Footer>
  );
}

/** The Cancel every modal's start slot opens with. */
export function CancelButton({
  onPress,
  isDisabled,
}: {
  onPress: () => void;
  isDisabled?: boolean;
}) {
  const tActions = useTranslations("common.actions");

  return (
    <ActionButton action="cancel" isDisabled={isDisabled} onPress={onPress}>
      {tActions("cancel")}
    </ActionButton>
  );
}

type ConfirmModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  /** The primary button, at the end opposite Cancel. */
  confirm: ReactNode;
  /** More start-slot actions after Cancel, such as a second way out. */
  start?: ReactNode;
  /** A destructive confirm: the title takes the danger colour. */
  danger?: boolean;
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
  start,
  danger,
  isCancelDisabled,
  "data-testid": testId,
}: ConfirmModalProps) {
  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="z-[1100]">
        <Modal.Dialog data-testid={testId}>
          {({ close }) => (
            <>
              <Modal.Header
                className={twMerge("flex-row items-center gap-2", danger && "text-danger")}
              >
                {title}
              </Modal.Header>
              <Modal.Body className="flex flex-col">{children}</Modal.Body>
              <ModalFooter
                start={
                  <>
                    <CancelButton isDisabled={isCancelDisabled} onPress={close} />
                    {start}
                  </>
                }
              >
                {confirm}
              </ModalFooter>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
