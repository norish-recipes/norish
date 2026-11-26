"use client";

import type { ComponentType, SVGProps } from "react";
import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { Note } from "@/components/shared/note";
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

/** What one action's confirmation says; the modal adds the lines every restart carries. */
export type SystemActionCopy = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  message: string;
  confirmLabel: string;
  warnings: string[];
};

type SystemActionModalProps = {
  copy: SystemActionCopy;
  isOpen: boolean;
  /** The confirmed action is running: its button is held, and Cancel with it. */
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/** Confirms a System card action, each of which restarts the server. */
export default function SystemActionModal({
  copy,
  isOpen,
  isPending,
  onClose,
  onConfirm,
}: SystemActionModalProps) {
  const t = useTranslations("settings.admin.restart");

  return (
    <ConfirmModal
      confirm={
        <ActionButton
          action="apply"
          icon={copy.icon}
          isPending={isPending}
          variant="secondary"
          onPress={onConfirm}
        >
          {copy.confirmLabel}
        </ActionButton>
      }
      headerClassName="flex items-center gap-2"
      isCancelDisabled={isPending}
      isOpen={isOpen}
      title={
        <>
          <ExclamationTriangleIcon className="text-warning h-5 w-5" />
          {copy.title}
        </>
      }
      onOpenChange={onClose}
    >
      <p>{copy.message}</p>
      <Note className="mt-2" status="warning" title={t("importantTitle")}>
        <ul className="list-inside list-disc space-y-1">
          {copy.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
          <li>
            {t.rich("warning3", {
              code: (chunks) => <code className="bg-default rounded px-1">{chunks}</code>,
            })}
          </li>
        </ul>
      </Note>
    </ConfirmModal>
  );
}
