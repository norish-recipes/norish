"use client";

import { useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton } from "@/components/shared/action-button";
import { ShieldCheckIcon, UserMinusIcon } from "@heroicons/react/16/solid";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import { Chip, Table } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useHousehold, useHouseholdMutations } from "@norish/shared-react/reader";

import ConfirmModal from "./confirm-modal";

type ChosenMember = { id: string; name: string };

export default function MembersCard() {
  const t = useTranslations("settings.household.members");
  const ti = useTranslations("settings.household.info");
  const { household, currentUserId, isAdmin } = useHousehold();
  const { kickUser, transferAdmin } = useHouseholdMutations();
  const [showKickModal, setShowKickModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [userToKick, setUserToKick] = useState<ChosenMember | null>(null);
  const [userToTransfer, setUserToTransfer] = useState<ChosenMember | null>(null);
  if (!household) return null;

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

      <ConfirmModal
        confirm={
          <ActionButton
            action="remove"
            icon={UserMinusIcon}
            variant="danger"
            onPress={handleKickUser}
          >
            {t("kickModal.confirmButton")}
          </ActionButton>
        }
        isOpen={showKickModal}
        title={t("kickModal.title")}
        onOpenChange={setShowKickModal}
      >
        <p>{t("kickModal.confirmMessage", { name: userToKick?.name ?? "" })}</p>
        <p className="text-muted mt-2 text-base">{t("kickModal.warning")}</p>
      </ConfirmModal>
      <ConfirmModal
        confirm={
          <ActionButton action="apply" icon={ShieldCheckIcon} onPress={handleTransferAdmin}>
            {t("transferModal.confirmButton")}
          </ActionButton>
        }
        isOpen={showTransferModal}
        title={t("transferModal.title")}
        onOpenChange={setShowTransferModal}
      >
        <p>{t("transferModal.confirmMessage", { name: userToTransfer?.name ?? "" })}</p>
        <p className="text-muted mt-2 text-base">{t("transferModal.warning")}</p>
      </ConfirmModal>
    </>
  );
}
