"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { TrashIcon } from "@heroicons/react/24/outline";

import { useUserSettingsContext } from "../context";

export default function DangerZoneCard() {
  const { deleteAccount } = useUserSettingsContext();
  const [showAccountDeleteModal, setShowAccountDeleteModal] = useState(false);

  const handleDeleteAccount = async () => {
    await deleteAccount();
  };

  return (
    <>
      <Card className="border-danger-200 dark:border-danger-900">
        <CardHeader>
          <h2 className="text-danger text-lg font-semibold">Danger Zone</h2>
        </CardHeader>
        <CardBody className="gap-4">
          <p className="text-default-600 text-base">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <div className="flex justify-end">
            <Button
              color="danger"
              startContent={<TrashIcon className="h-4 w-4" />}
              variant="flat"
              onPress={() => setShowAccountDeleteModal(true)}
            >
              Delete My Account
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Delete Account Confirmation */}
      <Modal isOpen={showAccountDeleteModal} onOpenChange={setShowAccountDeleteModal}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="text-danger">Delete Account</ModalHeader>
              <ModalBody>
                <p className="text-danger mb-2 font-semibold">
                  This action is permanent and cannot be undone!
                </p>
                <p>
                  Your personal data including groceries, calendar entries, and notes will be
                  permanently deleted.
                </p>
                <p className="mt-2">
                  Recipes you created will be preserved but will no longer be linked to your
                  account.
                </p>
                <p className="mt-2">
                  If you are the admin of a household with other members, you must transfer admin
                  privileges first.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="danger" onPress={handleDeleteAccount}>
                  Delete My Account
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
