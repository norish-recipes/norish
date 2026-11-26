"use client";

import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { usePending } from "@/hooks/use-pending";
import { useTranslations } from "next-intl";

interface SignOutConfirmModalProps {
  isOpen: boolean;
  /** How many queued offline changes a confirmed sign-out discards. */
  unsyncedCount: number;
  onOpenChange: (open: boolean) => void;
  /** Runs the destructive path: discard the queue, clear caches, sign out. */
  onConfirm: () => Promise<void>;
}

/**
 * The guided sign-out warning (ADR-0009): explicit sign-out with a non-empty
 * active Outbox explains the consequence and offers Cancel / Sign out. Cancel
 * changes nothing; the queue is discarded only after the confirmation.
 */
export function SignOutConfirmModal({
  isOpen,
  unsyncedCount,
  onOpenChange,
  onConfirm,
}: SignOutConfirmModalProps) {
  const t = useTranslations("navbar.userMenu");
  const [busy, whileBusy] = usePending();

  const confirm = async () => {
    await whileBusy(() => onConfirm());
  };

  return (
    <ConfirmModal
      confirm={
        <ActionButton
          action="delete"
          isDisabled={busy}
          variant="danger"
          onPress={() => void confirm()}
        >
          {t("logout")}
        </ActionButton>
      }
      isCancelDisabled={busy}
      isOpen={isOpen}
      title={t("signOutConfirm.title")}
      onOpenChange={onOpenChange}
    >
      <p className="text-sm">{t("signOutConfirm.description", { count: unsyncedCount })}</p>
    </ConfirmModal>
  );
}
