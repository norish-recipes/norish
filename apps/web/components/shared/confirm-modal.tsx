"use client";

import type { ComponentProps, ReactNode } from "react";
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

/** Every modal's header: the title as the dialog's heading (its accessible name), `aside` after it. */
export function ModalTitle({
  children,
  aside,
  danger,
}: {
  children: ReactNode;
  aside?: ReactNode;
  danger?: boolean;
}) {
  return (
    <Modal.Header className={twMerge("flex-row items-center gap-2", danger && "text-danger")}>
      <Modal.Heading className="flex items-center gap-2">{children}</Modal.Heading>
      {aside}
    </Modal.Header>
  );
}

const WIDE_DIALOG = "max-h-[85vh] max-w-3xl";

type ModalFrameProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** The wide placement, for content such as a log or a payload; the height rule goes with it. */
  wide?: boolean;
  /** False where only the dialog's own button closes it. */
  isDismissable?: boolean;
  "data-testid"?: string;
  children: ComponentProps<typeof Modal.Dialog>["children"];
};

/** The dialog every modal sits in: the default width, or `wide` with its own height limit. */
export function ModalFrame({
  isOpen,
  onOpenChange,
  wide,
  isDismissable,
  "data-testid": testId,
  children,
}: ModalFrameProps) {
  return (
    // pointer-events-auto undoes the `pointer-events: none` vaul sets on <body> under a drawer.
    <Modal.Backdrop
      className="pointer-events-auto z-[1099]"
      isDismissable={isDismissable}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <Modal.Container className="z-[1100]">
        <Modal.Dialog className={wide ? WIDE_DIALOG : undefined} data-testid={testId}>
          {children}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
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
    <ModalFrame data-testid={testId} isOpen={isOpen} onOpenChange={onOpenChange}>
      {({ close }) => (
        <>
          <ModalTitle danger={danger}>{title}</ModalTitle>
          <Modal.Body className="flex flex-col gap-2">{children}</Modal.Body>
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
    </ModalFrame>
  );
}
