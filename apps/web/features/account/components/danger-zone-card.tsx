"use client";

import { useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import { useDeleteAccountMutation } from "@norish/shared-react/reader";

export default function DangerZoneCard() {
  const t = useTranslations("settings.user.dangerZone");
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

      <ConfirmModal
        confirm={
          <ActionButton action="delete" variant="danger" onPress={deleteAccount}>
            {t("deleteModal.confirmButton")}
          </ActionButton>
        }
        headerClassName="text-danger"
        isOpen={showAccountDeleteModal}
        title={t("deleteModal.title")}
        onOpenChange={setShowAccountDeleteModal}
      >
        <p className="text-danger mb-2 font-semibold">{t("deleteModal.permanentWarning")}</p>
        <p>{t("deleteModal.dataWarning")}</p>
        <p className="mt-2">{t("deleteModal.recipesNote")}</p>
        <p className="mt-2">{t("deleteModal.adminNote")}</p>
      </ConfirmModal>
    </>
  );
}
