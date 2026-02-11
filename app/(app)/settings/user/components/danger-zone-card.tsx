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
import { TrashIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useUserSettingsContext } from "../context";

export default function DangerZoneCard() {
  const t = useTranslations("settings.user.dangerZone");
  const tActions = useTranslations("common.actions");
  const { deleteAccount } = useUserSettingsContext();
  const [showAccountDeleteModal, setShowAccountDeleteModal] = useState(false);

  const handleDeleteAccount = async () => {
    await deleteAccount();
  };

  return (
    <>
      <Card className="border-danger-200 dark:border-danger-900">
        <CardHeader>
          <h2 className="text-danger text-lg font-semibold">{t("title")}</h2>
        </CardHeader>
        <CardBody className="gap-4">
          <p className="text-default-600 text-base">{t("description")}</p>
          <div className="flex justify-end">
            <Button
              color="danger"
              startContent={<TrashIcon className="h-4 w-4" />}
              variant="flat"
              onPress={() => setShowAccountDeleteModal(true)}
            >
              {t("deleteButton")}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Delete Account Confirmation */}
      <Modal
        classNames={{ wrapper: "z-[1100]", backdrop: "z-[1099]" }}
        isOpen={showAccountDeleteModal}
        onOpenChange={setShowAccountDeleteModal}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="text-danger">{t("deleteModal.title")}</ModalHeader>
              <ModalBody>
                <p className="text-danger mb-2 font-semibold">
                  {t("deleteModal.permanentWarning")}
                </p>
                <p>{t("deleteModal.dataWarning")}</p>
                <p className="mt-2">{t("deleteModal.recipesNote")}</p>
                <p className="mt-2">{t("deleteModal.adminNote")}</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {tActions("cancel")}
                </Button>
                <Button color="danger" onPress={handleDeleteAccount}>
                  {t("deleteModal.confirmButton")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
