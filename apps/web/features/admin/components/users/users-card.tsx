"use client";

import { useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { IconActionButton } from "@/components/shared/action-button";
import UserAvatar from "@/components/shared/user-avatar";
import DataTable from "@/components/ui/data-table";
import {
  ShieldCheckIcon as ShieldCheckIconSolid,
  UserGroupIcon as UserGroupIconSolid,
} from "@heroicons/react/16/solid";
import { UsersIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import type { AdminUserRowDTO } from "@norish/shared/contracts";
import { useUserMutations, useUsersListQuery } from "@norish/shared-react/admin";
import { useReader } from "@norish/shared-react/reader";

import { DeleteUserModal } from "./delete-user-modal";
import { ShieldMinusIcon } from "./shield-minus-icon";
import { UserRoleChips } from "./user-role-chips";

export default function UsersCard() {
  const t = useTranslations("settings.admin.users");
  const { user: currentUser } = useReader();
  const { users, isLoading, error } = useUsersListQuery();
  const { setAdminStatus, changingRoleOf, deleteUser, isDeleting } = useUserMutations();
  const [userToDelete, setUserToDelete] = useState<AdminUserRowDTO | null>(null);

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    const deleted = await deleteUser({
      userId: userToDelete.id,
      name: userToDelete.name || userToDelete.email,
    });

    if (deleted) setUserToDelete(null);
  };

  // A failed load must not read as "no users".
  const emptyState = isLoading ? t("loading") : error ? t("loadFailed") : t("empty");

  return (
    <SettingsCard description={t("description")} icon={UsersIcon} title={t("title")}>
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
              <UserRoleChips isServerAdmin={row.isServerAdmin} isServerOwner={row.isServerOwner} />
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
            align: "center",
            label: t("table.actions"),
            render: (row: AdminUserRowDTO) => {
              const isSelf = row.id === currentUser?.id;
              const canChangeRole = !row.isServerOwner && !(isSelf && row.isServerAdmin);
              const canDelete = !row.isServerOwner && !isSelf;
              const roleBusy = changingRoleOf === row.id;

              return (
                <div className="flex justify-center gap-1">
                  <IconActionButton
                    action={row.isServerAdmin ? "remove" : "edit"}
                    icon={row.isServerAdmin ? ShieldMinusIcon : ShieldCheckIconSolid}
                    isDisabled={!canChangeRole || roleBusy}
                    isPending={roleBusy}
                    label={row.isServerAdmin ? t("actions.revokeAdmin") : t("actions.makeAdmin")}
                    size="sm"
                    onPress={() => void setAdminStatus(row.id, !row.isServerAdmin)}
                  />
                  <IconActionButton
                    action="delete"
                    isDisabled={!canDelete}
                    label={t("actions.delete")}
                    size="sm"
                    onPress={() => setUserToDelete(row)}
                  />
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

      <DeleteUserModal
        isDeleting={isDeleting}
        isOpen={userToDelete !== null}
        userName={userToDelete?.name || userToDelete?.email || ""}
        onClose={() => setUserToDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </SettingsCard>
  );
}
