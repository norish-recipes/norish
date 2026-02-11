"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  addToast,
} from "@heroui/react";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import { UserMinusIcon, ShieldCheckIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useHouseholdSettingsContext } from "../context";

export default function MembersCard() {
  const t = useTranslations("settings.household.members");
  const ti = useTranslations("settings.household.info");
  const tActions = useTranslations("common.actions");
  const { household, currentUserId, kickUser, transferAdmin } = useHouseholdSettingsContext();
  const [showKickModal, setShowKickModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [userToKick, setUserToKick] = useState<{ id: string; name: string } | null>(null);
  const [userToTransfer, setUserToTransfer] = useState<{ id: string; name: string } | null>(null);

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
      addToast({
        title: t("toasts.kickFailed"),
        description: (error as Error).message,
        color: "danger",
        shouldShowTimeoutProgress: true,
        radius: "full",
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
      addToast({
        title: t("toasts.transferSuccess", { name: userToTransfer.name }),
        color: "success",
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    } catch (error) {
      addToast({
        title: t("toasts.transferFailed"),
        description: (error as Error).message,
        color: "danger",
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    } finally {
      setShowTransferModal(false);
      setUserToTransfer(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserGroupIcon className="h-5 w-5" />
            {t("title")}
          </h2>
        </CardHeader>
        <CardBody>
          <Table aria-label={t("title")}>
            <TableHeader>
              <TableColumn>{t("tableHeaders.name")}</TableColumn>
              <TableColumn>{t("tableHeaders.role")}</TableColumn>
              <TableColumn>{t("tableHeaders.actions")}</TableColumn>
            </TableHeader>
            <TableBody>
              {household.users.map((user) => {
                const isSelf = user.id === currentUserId;
                const isUserAdmin = user.isAdmin === true;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.name}
                        {isSelf && (
                          <Chip color="default" size="sm" variant="flat">
                            {t("you")}
                          </Chip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip color={isUserAdmin ? "primary" : "default"} size="sm" variant="flat">
                        {isUserAdmin ? ti("admin") : ti("member")}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {isAdmin && !isSelf && (
                          <>
                            <Button
                              color="danger"
                              size="sm"
                              startContent={<UserMinusIcon className="h-4 w-4" />}
                              variant="light"
                              onPress={() => {
                                setUserToKick({ id: user.id, name: user.name || "Unknown" });
                                setShowKickModal(true);
                              }}
                            >
                              {t("kickButton")}
                            </Button>
                            {!isUserAdmin && (
                              <Button
                                color="primary"
                                size="sm"
                                startContent={<ShieldCheckIcon className="h-4 w-4" />}
                                variant="light"
                                onPress={() => {
                                  setUserToTransfer({ id: user.id, name: user.name || "Unknown" });
                                  setShowTransferModal(true);
                                }}
                              >
                                {t("makeAdminButton")}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Kick User Modal */}
      <Modal
        classNames={{ wrapper: "z-[1100]", backdrop: "z-[1099]" }}
        isOpen={showKickModal}
        onOpenChange={setShowKickModal}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{t("kickModal.title")}</ModalHeader>
              <ModalBody>
                <p>{t("kickModal.confirmMessage", { name: userToKick?.name ?? "" })}</p>
                <p className="text-default-600 mt-2 text-base">{t("kickModal.warning")}</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {tActions("cancel")}
                </Button>
                <Button color="danger" onPress={handleKickUser}>
                  {t("kickModal.confirmButton")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Transfer Admin Modal */}
      <Modal
        classNames={{ wrapper: "z-[1100]", backdrop: "z-[1099]" }}
        isOpen={showTransferModal}
        onOpenChange={setShowTransferModal}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{t("transferModal.title")}</ModalHeader>
              <ModalBody>
                <p>{t("transferModal.confirmMessage", { name: userToTransfer?.name ?? "" })}</p>
                <p className="text-default-600 mt-2 text-base">{t("transferModal.warning")}</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {tActions("cancel")}
                </Button>
                <Button color="primary" onPress={handleTransferAdmin}>
                  {t("transferModal.confirmButton")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
