"use client";

import { useState } from "react";
import { Button, Modal } from "@heroui/react";
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
  const tCommon = useTranslations("common");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);

    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="z-[1100]" size="sm">
        <Modal.Dialog>
          {() => (
            <>
              <Modal.Header>{t("signOutConfirm.title")}</Modal.Header>
              <Modal.Body className="pb-4">
                <p className="text-sm">
                  {t("signOutConfirm.description", { count: unsyncedCount })}
                </p>
                <div className="flex justify-end gap-2 pt-3">
                  <Button
                    isDisabled={busy}
                    size="sm"
                    variant="tertiary"
                    onPress={() => onOpenChange(false)}
                  >
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    isDisabled={busy}
                    size="sm"
                    variant="danger"
                    onPress={() => void confirm()}
                  >
                    {t("logout")}
                  </Button>
                </div>
              </Modal.Body>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
