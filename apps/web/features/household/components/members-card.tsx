"use client";

import { useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { ShieldCheckIcon, UserMinusIcon } from "@heroicons/react/16/solid";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import { Chip, Modal, Table } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useHousehold, useHouseholdMutations } from "@norish/shared-react/reader";

type ChosenMember = { id: string; name: string };

export default function MembersCard() {
  const t = useTranslations("settings.household.members");
  const ti = useTranslations("settings.household.info");
  const tActions = useTranslations("common.actions");
  const { household, currentUserId } = useHousehold();
  const { kickUser, transferAdmin } = useHouseholdMutations();
  const [showKickModal, setShowKickModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [userToKick, setUserToKick] = useState<ChosenMember | null>(null);
  const [userToTransfer, setUserToTransfer] = useState<ChosenMember | null>(null);
  if (!household) return null;

  // Check if current user is admin
  const currentUserData = currentUserId
    ? household.users.find((u) => u.id === currentUserId)
    : null;
  const isAdmin = currentUserData?.isAdmin === true;
  const handleKickUser = () => {
    if (!userToKick) return;
    kickUser(household.id, userToKick.id);
    setShowKickModal(false);
    setUserToKick(null);
  };
  const handleTransferAdmin = () => {
    if (!userToTransfer) return;
    transferAdmin(household.id, userToTransfer.id);
    setShowTransferModal(false);
    setUserToTransfer(null);
  };
  return (
    <>
      <SettingsCard icon={UserGroupIcon} title={t("title")}>
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
                              <ActionButton
                                action="remove"
                                icon={UserMinusIcon}
                                size="sm"
                                onPress={() => {
                                  setUserToKick({
                                    id: user.id,
                                    name: user.name || t("unknown"),
                                  });
                                  setShowKickModal(true);
                                }}
                              >
                                {t("kickButton")}
                              </ActionButton>
                              {!isUserAdmin && (
                                <ActionButton
                                  action="edit"
                                  icon={ShieldCheckIcon}
                                  size="sm"
                                  onPress={() => {
                                    setUserToTransfer({
                                      id: user.id,
                                      name: user.name || t("unknown"),
                                    });
                                    setShowTransferModal(true);
                                  }}
                                >
                                  {t("makeAdminButton")}
                                </ActionButton>
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
      </SettingsCard>

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
                  <ActionButtonGroup>
                    <ActionButton action="cancel" onPress={onClose}>
                      {tActions("cancel")}
                    </ActionButton>
                    <ActionButton
                      action="remove"
                      icon={UserMinusIcon}
                      variant="danger"
                      onPress={handleKickUser}
                    >
                      {t("kickModal.confirmButton")}
                    </ActionButton>
                  </ActionButtonGroup>
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
                  <ActionButtonGroup>
                    <ActionButton action="cancel" onPress={onClose}>
                      {tActions("cancel")}
                    </ActionButton>
                    <ActionButton
                      action="apply"
                      icon={ShieldCheckIcon}
                      onPress={handleTransferAdmin}
                    >
                      {t("transferModal.confirmButton")}
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
