"use client";

import { useState } from "react";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ShieldCheckIcon, UserMinusIcon } from "@heroicons/react/16/solid";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import { Button, Card, Chip, Modal, Table, toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useHouseholdSettingsContext } from "../context";

export default function MembersCard() {
  const t = useTranslations("settings.household.members");
  const tErrors = useTranslations("common.errors");
  const ti = useTranslations("settings.household.info");
  const tActions = useTranslations("common.actions");
  const { household, currentUserId, kickUser, transferAdmin } = useHouseholdSettingsContext();
  const [showKickModal, setShowKickModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [userToKick, setUserToKick] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [userToTransfer, setUserToTransfer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  if (!household) return null;

  // Check if current user is admin
  const currentUserData = currentUserId
    ? household.users.find((u) => u.id === currentUserId)
    : null;
  const isAdmin = currentUserData?.isAdmin === true;
  const handleKickUser = async () => {
    if (!userToKick) return;
    try {
      await kickUser(household.id, userToKick.id);
    } catch (error) {
      showSafeErrorToast({
        title: t("toasts.kickFailed"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error,
        context: "household-members:kick",
      });
    } finally {
      setShowKickModal(false);
      setUserToKick(null);
    }
  };
  const handleTransferAdmin = async () => {
    if (!userToTransfer) return;
    try {
      await transferAdmin(household.id, userToTransfer.id);
      toast(
        t("toasts.transferSuccess", {
          name: userToTransfer.name,
        }),
        {
          variant: "success",
        }
      );
    } catch (error) {
      showSafeErrorToast({
        title: t("toasts.transferFailed"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error,
        context: "household-members:transfer-admin",
      });
    } finally {
      setShowTransferModal(false);
      setUserToTransfer(null);
    }
  };
  return (
    <>
      <Card>
        <Card.Header>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserGroupIcon className="h-5 w-5" />
            {t("title")}
          </h2>
        </Card.Header>
        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={t("title")}>
                <Table.Header>
                  <Table.Column id="name" isRowHeader>
                    {t("tableHeaders.name")}
                  </Table.Column>
                  <Table.Column id="role">{t("tableHeaders.role")}</Table.Column>
                  <Table.Column id="actions">{t("tableHeaders.actions")}</Table.Column>
                </Table.Header>
                <Table.Body>
                  {household.users.map((user) => {
                    const isSelf = user.id === currentUserId;
                    const isUserAdmin = user.isAdmin === true;

                    return (
                      <Table.Row key={user.id} id={user.id}>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            {user.name}
                            {isSelf && (
                              <Chip color="default" size="sm" variant="soft">
                                {t("you")}
                              </Chip>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip color={isUserAdmin ? "accent" : "default"} size="sm" variant="soft">
                            {isUserAdmin ? ti("admin") : ti("member")}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex gap-2">
                            {isAdmin && !isSelf && (
                              <>
                                <Button
                                  size="sm"
                                  onPress={() => {
                                    setUserToKick({
                                      id: user.id,
                                      name: user.name || "Unknown",
                                    });
                                    setShowKickModal(true);
                                  }}
                                  variant="danger-soft"
                                  className="min-w-16"
                                >
                                  {<UserMinusIcon className="h-4 w-4" />}
                                  {t("kickButton")}
                                </Button>
                                {!isUserAdmin && (
                                  <Button
                                    size="sm"
                                    onPress={() => {
                                      setUserToTransfer({
                                        id: user.id,
                                        name: user.name || "Unknown",
                                      });
                                      setShowTransferModal(true);
                                    }}
                                    variant="tertiary"
                                    className="min-w-16"
                                  >
                                    {<ShieldCheckIcon className="h-4 w-4" />}
                                    {t("makeAdminButton")}
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>

      {/* Kick User Modal */}
      <Modal.Backdrop className="z-[1099]" isOpen={showKickModal} onOpenChange={setShowKickModal}>
        <Modal.Container className="z-[1100]">
          <Modal.Dialog>
            {({ close: onClose }) => (
              <>
                <Modal.Header>{t("kickModal.title")}</Modal.Header>
                <Modal.Body>
                  <p>
                    {t("kickModal.confirmMessage", {
                      name: userToKick?.name ?? "",
                    })}
                  </p>
                  <p className="text-muted mt-2 text-base">{t("kickModal.warning")}</p>
                </Modal.Body>
                <Modal.Footer>
                  <Button onPress={onClose} variant="tertiary">
                    {tActions("cancel")}
                  </Button>
                  <Button onPress={handleKickUser} variant="danger">
                    {t("kickModal.confirmButton")}
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {/* Transfer Admin Modal */}
      <Modal.Backdrop
        className="z-[1099]"
        isOpen={showTransferModal}
        onOpenChange={setShowTransferModal}
      >
        <Modal.Container className="z-[1100]">
          <Modal.Dialog>
            {({ close: onClose }) => (
              <>
                <Modal.Header>{t("transferModal.title")}</Modal.Header>
                <Modal.Body>
                  <p>
                    {t("transferModal.confirmMessage", {
                      name: userToTransfer?.name ?? "",
                    })}
                  </p>
                  <p className="text-muted mt-2 text-base">{t("transferModal.warning")}</p>
                </Modal.Body>
                <Modal.Footer>
                  <Button onPress={onClose} variant="tertiary">
                    {tActions("cancel")}
                  </Button>
                  <Button onPress={handleTransferAdmin} variant="primary">
                    {t("transferModal.confirmButton")}
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
