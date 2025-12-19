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
import { HomeIcon, ArrowRightIcon } from "@heroicons/react/16/solid";

import { useHouseholdSettingsContext } from "../context";

export default function HouseholdInfoCard() {
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
            <span className="text-default-600 text-base">Your Role</span>
            <Chip color={isAdmin ? "primary" : "default"} size="sm" variant="flat">
              {isAdmin ? "Admin" : "Member"}
            </Chip>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-default-600 text-base">Members</span>
            <span className="text-base font-medium">{household.users.length}</span>
          </div>
          <Divider />
          <div className="flex justify-end">
            <Button
              color="danger"
              startContent={<ArrowRightIcon className="h-4 w-4" />}
              variant="flat"
              onPress={() => setShowLeaveModal(true)}
            >
              Leave Household
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Leave Household Modal */}
      <Modal isOpen={showLeaveModal} onOpenChange={setShowLeaveModal}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Leave Household</ModalHeader>
              <ModalBody>
                <p>
                  Are you sure you want to leave{" "}
                  <span className="font-semibold">{household.name}</span>?
                </p>
                {isAdmin && otherMembers.length > 0 && (
                  <p className="text-warning mt-2">
                    You are the admin. You must transfer admin privileges before leaving.
                  </p>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="danger" onPress={handleLeaveHousehold}>
                  Leave Household
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
