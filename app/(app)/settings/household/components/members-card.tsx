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
import { UserGroupIcon, UserMinusIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

import { useHouseholdSettingsContext } from "../context";

export default function MembersCard() {
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
        title: "Failed to kick user",
        description: (error as Error).message,
        color: "danger",
        timeout: 2000,
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
      addToast({ title: `Transferred admin to ${userToTransfer.name}`, color: "success", timeout: 2000, shouldShowTimeoutProgress: true, radius: "full",});
    } catch (error) {
      addToast({
        title: "Failed to transfer admin",
        description: (error as Error).message,
        color: "danger",
        timeout: 2000,
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
            Members
          </h2>
        </CardHeader>
        <CardBody>
          <Table aria-label="Household members">
            <TableHeader>
              <TableColumn>NAME</TableColumn>
              <TableColumn>ROLE</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
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
                            You
                          </Chip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip color={isUserAdmin ? "primary" : "default"} size="sm" variant="flat">
                        {isUserAdmin ? "Admin" : "Member"}
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
                              Kick
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
                                Make Admin
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
      <Modal isOpen={showKickModal} onOpenChange={setShowKickModal}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Kick User</ModalHeader>
              <ModalBody>
                <p>
                  Are you sure you want to kick{" "}
                  <span className="font-semibold">{userToKick?.name}</span> from the household?
                </p>
                <p className="text-default-600 mt-2 text-base">
                  They will lose access to all shared recipes, groceries, and calendar entries.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="danger" onPress={handleKickUser}>
                  Kick User
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Transfer Admin Modal */}
      <Modal isOpen={showTransferModal} onOpenChange={setShowTransferModal}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Transfer Admin Privileges</ModalHeader>
              <ModalBody>
                <p>
                  Are you sure you want to transfer admin privileges to{" "}
                  <span className="font-semibold">{userToTransfer?.name}</span>?
                </p>
                <p className="text-default-600 mt-2 text-base">
                  You will become a regular member and will no longer be able to kick users or
                  manage join codes.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" onPress={handleTransferAdmin}>
                  Transfer Admin
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
