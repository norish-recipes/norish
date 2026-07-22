"use client";

import { useState } from "react";
import { TrashIcon } from "@heroicons/react/16/solid";
import { Button, Card, Modal } from "@heroui/react";
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
      <Card className="border-danger/30 dark:border-danger/30">
        <Card.Header>
          <h2 className="text-danger text-lg font-semibold">{t("title")}</h2>
        </Card.Header>
        <Card.Content className="gap-4">
          <p className="text-muted text-base">{t("description")}</p>
          <div className="flex justify-end">
            <Button onPress={() => setShowAccountDeleteModal(true)} variant="danger-soft">
              {<TrashIcon className="h-4 w-4" />}
              {t("deleteButton")}
            </Button>
          </div>
        </Card.Content>
      </Card>

      {/* Delete Account Confirmation */}
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
                  <Button onPress={onClose} variant="tertiary">
                    {tActions("cancel")}
                  </Button>
                  <Button onPress={handleDeleteAccount} variant="danger">
                    {t("deleteModal.confirmButton")}
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
