"use client";

import { useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { ArrowLeftStartOnRectangleIcon } from "@heroicons/react/16/solid";
import { HomeIcon } from "@heroicons/react/24/outline";
import { Chip, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useHousehold, useHouseholdMutations } from "@norish/shared-react/reader";

export default function HouseholdInfoCard() {
  const t = useTranslations("settings.household.info");
  const { household, currentUserId, isAdmin } = useHousehold();
  const { leaveHousehold } = useHouseholdMutations();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  if (!household) return null;

  const otherMembers = household.users.filter((u) => u.id !== currentUserId);
  const handleLeaveHousehold = () => {
    leaveHousehold(household.id);
    setShowLeaveModal(false);
  };
  return (
    <>
      <SettingsCard icon={HomeIcon} title={household.name}>
        <div className="flex items-center justify-between">
          <span className="text-muted text-base">{t("yourRole")}</span>
          <Chip color={isAdmin ? "accent" : "default"} size="sm" variant="soft">
            {isAdmin ? t("admin") : t("member")}
          </Chip>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted text-base">{t("members")}</span>
          <span className="text-base font-medium">{household.users.length}</span>
        </div>
        <Separator />
        <ActionButtonGroup>
          <ActionButton
            action="remove"
            icon={ArrowLeftStartOnRectangleIcon}
            onPress={() => setShowLeaveModal(true)}
          >
            {t("leaveButton")}
          </ActionButton>
        </ActionButtonGroup>
      </SettingsCard>

      <ConfirmModal
        confirm={
          <ActionButton
            action="remove"
            icon={ArrowLeftStartOnRectangleIcon}
            variant="danger"
            onPress={handleLeaveHousehold}
          >
            {t("leaveModal.confirmButton")}
          </ActionButton>
        }
        isOpen={showLeaveModal}
        title={t("leaveModal.title")}
        onOpenChange={setShowLeaveModal}
      >
        <p>{t("leaveModal.confirmMessage", { name: household.name })}</p>
        {isAdmin && otherMembers.length > 0 && (
          <p className="text-warning mt-2">{t("leaveModal.adminWarning")}</p>
        )}
      </ConfirmModal>
    </>
  );
}
