"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { HomeIcon } from "@heroicons/react/24/outline";
import { ArrowLeftStartOnRectangleIcon } from "@heroicons/react/16/solid";
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
        <CardHeader>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <HomeIcon className="h-5 w-5" />
            {household.name}
          </h2>
        </CardHeader>
        <CardBody className="gap-4">
          <div className="flex items-center justify-between">
            <span className="text-default-600 text-base">{t("yourRole")}</span>
            <Chip color={isAdmin ? "primary" : "default"} size="sm" variant="flat">
              {isAdmin ? t("admin") : t("member")}
            </Chip>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-default-600 text-base">{t("members")}</span>
            <span className="text-base font-medium">{household.users.length}</span>
          </div>
          <Divider />
          <div className="flex justify-end">
            <Button
              color="danger"
              startContent={<ArrowLeftStartOnRectangleIcon className="h-4 w-4" />}
              variant="flat"
              onPress={() => setShowLeaveModal(true)}
            >
              {t("leaveButton")}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Leave Household Modal */}
      <Modal
        classNames={{ wrapper: "z-[1100]", backdrop: "z-[1099]" }}
        isOpen={showLeaveModal}
        onOpenChange={setShowLeaveModal}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{t("leaveModal.title")}</ModalHeader>
              <ModalBody>
                <p>{t("leaveModal.confirmMessage", { name: household.name })}</p>
                {isAdmin && otherMembers.length > 0 && (
                  <p className="text-warning mt-2">{t("leaveModal.adminWarning")}</p>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {tActions("cancel")}
                </Button>
                <Button color="danger" onPress={handleLeaveHousehold}>
                  {t("leaveModal.confirmButton")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
