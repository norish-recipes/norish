"use client";

import { useState } from "react";
import { ArrowLeftStartOnRectangleIcon } from "@heroicons/react/16/solid";
import { HomeIcon } from "@heroicons/react/24/outline";
import { Button, Card, Chip, Modal, Separator } from "@heroui/react";
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
      <Card>
        <Card.Header>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <HomeIcon className="h-5 w-5" />
            {household.name}
          </h2>
        </Card.Header>
        <Card.Content className="gap-4">
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
          <div className="flex justify-end">
            <Button onPress={() => setShowLeaveModal(true)} variant="danger-soft">
              {<ArrowLeftStartOnRectangleIcon className="h-4 w-4" />}
              {t("leaveButton")}
            </Button>
          </div>
        </Card.Content>
      </Card>

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
                  <Button onPress={onClose} variant="tertiary">
                    {tActions("cancel")}
                  </Button>
                  <Button onPress={handleLeaveHousehold} variant="danger">
                    {t("leaveModal.confirmButton")}
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
