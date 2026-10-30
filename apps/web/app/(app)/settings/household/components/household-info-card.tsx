"use client";

import { useState } from "react";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { ArrowLeftStartOnRectangleIcon } from "@heroicons/react/16/solid";
import { HomeIcon } from "@heroicons/react/24/outline";
import { Chip, Modal, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useHouseholdSettingsContext } from "../context";

export default function HouseholdInfoCard() {
  const t = useTranslations("settings.household.info");
  const tActions = useTranslations("common.actions");
  const { household, currentUserId, leaveHousehold } = useHouseholdSettingsContext();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  if (!household) return null;

  // Check if current user is admin
  const currentUserData = currentUserId
    ? household.users.find((u) => u.id === currentUserId)
    : null;
  const isAdmin = currentUserData?.isAdmin === true;
  const otherMembers = household.users.filter((u) => u.id !== currentUserId);
  const handleLeaveHousehold = async () => {
    await leaveHousehold(household.id);
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

      {/* Leave Household Modal */}
      <Modal.Backdrop className="z-[1099]" isOpen={showLeaveModal} onOpenChange={setShowLeaveModal}>
        <Modal.Container className="z-[1100]">
          <Modal.Dialog>
            {({ close: onClose }) => (
              <>
                <Modal.Header>{t("leaveModal.title")}</Modal.Header>
                <Modal.Body>
                  <p>
                    {t("leaveModal.confirmMessage", {
                      name: household.name,
                    })}
                  </p>
                  {isAdmin && otherMembers.length > 0 && (
                    <p className="text-warning mt-2">{t("leaveModal.adminWarning")}</p>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <ActionButtonGroup>
                    <ActionButton action="cancel" onPress={onClose}>
                      {tActions("cancel")}
                    </ActionButton>
                    <ActionButton
                      action="remove"
                      icon={ArrowLeftStartOnRectangleIcon}
                      variant="danger"
                      onPress={handleLeaveHousehold}
                    >
                      {t("leaveModal.confirmButton")}
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
