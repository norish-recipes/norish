"use client";

import type { ComponentType, SVGProps } from "react";
import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { Note } from "@/components/shared/note";
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

type RestartConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  message: string;
  confirmLabel: string;
  /** What this restart ends, listed before the warning every restart carries. */
  warnings: string[];
};

/** Confirms an action that restarts the server: a plain restart, or one that rotates the key. */
export default function RestartConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  icon,
  title,
  message,
  confirmLabel,
  warnings,
}: RestartConfirmationModalProps) {
  const t = useTranslations("settings.admin.restart");

  return (
    <ConfirmModal
      confirm={
        <ActionButton action="apply" icon={icon} variant="secondary" onPress={onConfirm}>
          {confirmLabel}
        </ActionButton>
      }
      headerClassName="flex items-center gap-2"
      isOpen={isOpen}
      title={
        <>
          <ExclamationTriangleIcon className="text-warning h-5 w-5" />
          {title}
        </>
      }
      onOpenChange={onClose}
    >
      <p>{message}</p>
      <Note className="mt-2" status="warning" title={t("importantTitle")}>
        <ul className="list-inside list-disc space-y-1">
          {warnings.map((warning) => (
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
