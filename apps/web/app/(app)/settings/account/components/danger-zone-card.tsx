"use client";

import { useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { Modal } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useDeleteAccountMutation } from "@norish/shared-react/reader";

export default function DangerZoneCard() {
  const t = useTranslations("settings.user.dangerZone");
  const tActions = useTranslations("common.actions");
  const { deleteAccount } = useDeleteAccountMutation();
  const [showAccountDeleteModal, setShowAccountDeleteModal] = useState(false);
  return (
    <>
      <SettingsCard
        danger
        description={t("description")}
        icon={ExclamationCircleIcon}
        title={t("title")}
      >
        <ActionButtonGroup>
          <ActionButton action="delete" onPress={() => setShowAccountDeleteModal(true)}>
            {t("deleteButton")}
          </ActionButton>
        </ActionButtonGroup>
      </SettingsCard>

      <Modal.Backdrop
        className="z-[1099]"
        isOpen={showAccountDeleteModal}
        onOpenChange={setShowAccountDeleteModal}
      >
        <Modal.Container className="z-[1100]">
          <Modal.Dialog>
            {({ close: onClose }) => (
              <>
                <Modal.Header className="text-danger">{t("deleteModal.title")}</Modal.Header>
                <Modal.Body>
                  <p className="text-danger mb-2 font-semibold">
                    {t("deleteModal.permanentWarning")}
                  </p>
                  <p>{t("deleteModal.dataWarning")}</p>
                  <p className="mt-2">{t("deleteModal.recipesNote")}</p>
                  <p className="mt-2">{t("deleteModal.adminNote")}</p>
                </Modal.Body>
                <Modal.Footer>
                  <ActionButtonGroup>
                    <ActionButton action="cancel" onPress={onClose}>
                      {tActions("cancel")}
                    </ActionButton>
                    <ActionButton action="delete" variant="danger" onPress={deleteAccount}>
                      {t("deleteModal.confirmButton")}
                    </ActionButton>
                  </ActionButtonGroup>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
