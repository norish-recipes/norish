"use client";

import { useState } from "react";
import UserAvatar from "@/components/shared/user-avatar";
import DataTable from "@/components/ui/data-table";
import { useUserContext } from "@/context/user-context";
import { useUserMutations, useUsersListQuery } from "@/hooks/admin";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import {
  NoSymbolIcon,
  ShieldCheckIcon as ShieldCheckIconSolid,
  TrashIcon,
  UserGroupIcon as UserGroupIconSolid,
} from "@heroicons/react/16/solid";
import { UsersIcon } from "@heroicons/react/24/outline";
import { Button, Card, toast, Tooltip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { AdminUserRowDTO } from "@norish/shared/contracts";

import { DeleteUserModal } from "./users/delete-user-modal";
import { UserRoleChips } from "./users/user-role-chips";

export default function UsersCard() {
  const t = useTranslations("settings.admin.users");
  const tErrors = useTranslations("common.errors");
  const { user: currentUser } = useUserContext();
  const { users, isLoading, error } = useUsersListQuery();
  const { setAdminStatus, deleteUser, isUpdatingAdminStatus, isDeleting } = useUserMutations();

  const [pendingRoleChangeId, setPendingRoleChangeId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<AdminUserRowDTO | null>(null);

  const handleToggleAdmin = async (row: AdminUserRowDTO) => {
    setPendingRoleChangeId(row.id);

    try {
      const result = await setAdminStatus(row.id, !row.isServerAdmin);

      if (!result.success) {
        showSafeErrorToast({
          title: tErrors("operationFailed"),
          description: result.error,
        });
      }
    } finally {
      setPendingRoleChangeId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    const result = await deleteUser(userToDelete.id);

    if (result.success) {
      toast(t("deleteSuccess", { name: userToDelete.name || userToDelete.email }), {
        variant: "success",
      });
      setUserToDelete(null);
    } else {
      showSafeErrorToast({
        title: tErrors("operationFailed"),
        description: result.error,
      });
    }
  };

  // The empty slot is the only place this table can speak from, so it has to
  // tell a failed load apart from a server that genuinely has no users —
  // otherwise a broken list reads as "there is nobody here".
  const emptyState = isLoading ? t("loading") : error ? t("loadFailed") : t("empty");

  return (
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UsersIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="gap-4">
        <p className="text-muted text-base">{t("description")}</p>

        <DataTable
          aria-label={t("title")}
          columns={[
            {
              key: "user",
              label: t("table.user"),
              isRowHeader: true,
              render: (row: AdminUserRowDTO) => (
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar
                    email={row.email}
                    image={row.image}
                    name={row.name}
                    size="sm"
                    userId={row.id}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{row.name || row.email}</span>
                    <span className="text-muted truncate text-xs">{row.email}</span>
                  </div>
                </div>
              ),
            },
            {
              key: "role",
              label: t("table.role"),
              render: (row: AdminUserRowDTO) => (
                <UserRoleChips
                  isServerAdmin={row.isServerAdmin}
                  isServerOwner={row.isServerOwner}
                />
              ),
            },
            {
              key: "household",
              hideOnNarrow: true,
              label: t("table.household"),
              className: "text-sm",
              render: (row: AdminUserRowDTO) => row.household?.name ?? t("noHousehold"),
            },
            {
              key: "joined",
              hideOnNarrow: true,
              label: t("table.joined"),
              className: "text-sm",
              render: (row: AdminUserRowDTO) => new Date(row.createdAt).toLocaleDateString(),
            },
            {
              key: "actions",
              label: t("table.actions"),
              className: "text-right",
              render: (row: AdminUserRowDTO) => {
                const isSelf = row.id === currentUser?.id;
                const canChangeRole = !row.isServerOwner && !(isSelf && row.isServerAdmin);
                const canDelete = !row.isServerOwner && !isSelf;
                const roleBusy = isUpdatingAdminStatus && pendingRoleChangeId === row.id;

                return (
                  <div className="flex justify-end gap-1">
                    <Tooltip delay={0}>
                      <Button
                        isIconOnly
                        aria-label={
                          row.isServerAdmin ? t("actions.revokeAdmin") : t("actions.makeAdmin")
                        }
                        isDisabled={!canChangeRole || roleBusy}
                        isPending={roleBusy}
                        variant={row.isServerAdmin ? "danger-soft" : "tertiary"}
                        onPress={() => void handleToggleAdmin(row)}
                      >
                        {row.isServerAdmin ? (
                          <NoSymbolIcon className="h-4 w-4" />
                        ) : (
                          <ShieldCheckIconSolid className="h-4 w-4" />
                        )}
                      </Button>
                      <Tooltip.Content placement="top">
                        <p>
                          {row.isServerAdmin ? t("actions.revokeAdmin") : t("actions.makeAdmin")}
                        </p>
                      </Tooltip.Content>
                    </Tooltip>

                    <Tooltip delay={0}>
                      <Button
                        isIconOnly
                        aria-label={t("actions.delete")}
                        isDisabled={!canDelete}
                        variant="danger-soft"
                        onPress={() => setUserToDelete(row)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                      <Tooltip.Content placement="top">
                        <p>{t("actions.delete")}</p>
                      </Tooltip.Content>
                    </Tooltip>
                  </div>
                );
              },
            },
          ]}
          emptyState={emptyState}
          rowKey={(row: AdminUserRowDTO) => row.id}
          rows={users}
        />

        {isLoading || error ? null : (
          <p className="text-muted flex items-center gap-1.5 text-xs">
            <UserGroupIconSolid className="h-3.5 w-3.5" />
            {t("countSummary", { count: users.length })}
          </p>
        )}
      </Card.Content>

      <DeleteUserModal
        isDeleting={isDeleting}
        isOpen={userToDelete !== null}
        userName={userToDelete?.name || userToDelete?.email || ""}
        onClose={() => setUserToDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </Card>
  );
}
