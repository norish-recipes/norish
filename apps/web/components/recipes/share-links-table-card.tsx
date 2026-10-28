"use client";

import { useState } from "react";
import NewFeatureChip from "@/app/(app)/settings/components/new-feature-chip";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import RecipeShareStatusChip from "@/components/recipes/recipe-share-status-chip";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { sharedRecipeShareHooks } from "@/hooks/recipes/shared-recipe-hooks";
import { PauseIcon, PlayIcon } from "@heroicons/react/16/solid";
import { LinkIcon } from "@heroicons/react/24/outline";
import { Modal, Skeleton, Table } from "@heroui/react";
import { useFormatter, useTranslations } from "next-intl";

import type {
  AdminRecipeShareInventoryDto,
  RecipeShareInventoryDto,
} from "@norish/shared/contracts/dto/recipe-shares";

type ShareRow = RecipeShareInventoryDto | AdminRecipeShareInventoryDto;
type ConfirmAction = {
  share: ShareRow;
  type: "revoke" | "reactivate" | "delete";
} | null;
type Props = {
  namespace: "settings.user.shareLinks" | "settings.admin.shareLinks";
  shares: ShareRow[];
  isLoading: boolean;
  showOwner?: boolean;
};
type ColumnKey = "recipe" | "owner" | "status" | "created" | "expires" | "actions";
/** toLocaleString's fields, in the locale and zone next-intl gives server and browser alike. */
const DATE_AND_TIME = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
} as const;
/** Each confirm's button: Delete is the irreversible one, Revoke can be undone. */
const CONFIRM_BUTTONS = {
  revoke: { action: "remove", icon: PauseIcon, variant: "danger-soft" },
  reactivate: { action: "apply", icon: PlayIcon, variant: "primary" },
  delete: { action: "delete", variant: "danger" },
} as const;
function hasOwnerFields(share: ShareRow): share is AdminRecipeShareInventoryDto {
  return "ownerId" in share;
}
export default function ShareLinksTableCard({
  namespace,
  shares,
  isLoading,
  showOwner = false,
}: Props) {
  const t = useTranslations(namespace);
  const tActions = useTranslations("common.actions");
  const format = useFormatter();
  const formatDate = (date: Date | null) =>
    date ? format.dateTime(new Date(date), DATE_AND_TIME) : "-";
  const { revokeShare, reactivateShare, deleteShare, isRevoking, isReactivating, isDeleting } =
    sharedRecipeShareHooks.useRecipeShareMutations(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const handleConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "revoke")
      revokeShare(confirmAction.share.id, confirmAction.share.version);
    if (confirmAction.type === "reactivate")
      reactivateShare(confirmAction.share.id, confirmAction.share.version);
    if (confirmAction.type === "delete")
      deleteShare(confirmAction.share.id, confirmAction.share.version);
    setConfirmAction(null);
  };
  const columns: Array<{
    key: ColumnKey;
    label: string;
  }> = [
    {
      key: "recipe",
      label: t("table.recipe"),
    },
    ...(showOwner
      ? [
          {
            key: "owner" as const,
            label: t("table.owner"),
          },
        ]
      : []),
    {
      key: "status",
      label: t("table.status"),
    },
    {
      key: "created",
      label: t("table.created"),
    },
    {
      key: "expires",
      label: t("table.expires"),
    },
    {
      key: "actions",
      label: t("table.actions"),
    },
  ];
  const renderCell = (share: ShareRow, columnKey: ColumnKey) => {
    switch (columnKey) {
      case "recipe":
        return share.recipeName;
      case "owner":
        return hasOwnerFields(share) ? (share.ownerName ?? share.ownerId) : "-";
      case "status":
        return <RecipeShareStatusChip status={share.status} />;
      case "created":
        return formatDate(share.createdAt);
      case "expires":
        return formatDate(share.expiresAt);
      case "actions":
        return (
          <div className="flex gap-1">
            {share.status === "active" ? (
              <IconActionButton
                action="edit"
                icon={PauseIcon}
                label={t("revokeModal.title")}
                size="sm"
                onPress={() =>
                  setConfirmAction({
                    share,
                    type: "revoke",
                  })
                }
              />
            ) : null}
            {share.status === "revoked" ? (
              <IconActionButton
                action="edit"
                icon={PlayIcon}
                label={t("reactivateModal.title")}
                size="sm"
                onPress={() =>
                  setConfirmAction({
                    share,
                    type: "reactivate",
                  })
                }
              />
            ) : null}
            <IconActionButton
              action="delete"
              label={t("deleteModal.title")}
              size="sm"
              onPress={() =>
                setConfirmAction({
                  share,
                  type: "delete",
                })
              }
            />
          </div>
        );
    }
  };
  return (
    <>
      <SettingsCard
        badges={<NewFeatureChip showOnVersion="0.18.0" />}
        description={t("description")}
        icon={LinkIcon}
        title={t("title")}
      >
        {isLoading ? (
          // The tab skeleton's row for this card.
          <Skeleton className="h-12 w-full rounded-lg" />
        ) : shares.length === 0 ? (
          <p className="text-muted text-base">{t("empty")}</p>
        ) : (
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={t("title")}>
                <Table.Header columns={columns}>
                  {(column) => (
                    <Table.Column
                      key={column.key}
                      id={column.key}
                      isRowHeader={column.key === "recipe"}
                    >
                      {column.label}
                    </Table.Column>
                  )}
                </Table.Header>
                <Table.Body items={shares}>
                  {(share) => (
                    <Table.Row key={share.id} id={share.id}>
                      <Table.Collection items={columns}>
                        {(column) => <Table.Cell>{renderCell(share, column.key)}</Table.Cell>}
                      </Table.Collection>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </SettingsCard>
      <Modal.Backdrop isOpen={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <Modal.Container>
          <Modal.Dialog>
            {({ close: onClose }) => (
              <>
                <Modal.Header>
                  {confirmAction ? t(`${confirmAction.type}Modal.title`) : ""}
                </Modal.Header>
                <Modal.Body>
                  <p>
                    {confirmAction
                      ? t(`${confirmAction.type}Modal.message`, {
                          recipeName: confirmAction.share.recipeName,
                        })
                      : ""}
                  </p>
                </Modal.Body>
                <Modal.Footer>
                  <ActionButtonGroup>
                    <ActionButton action="cancel" onPress={onClose}>
                      {tActions("cancel")}
                    </ActionButton>
                    <ActionButton
                      {...CONFIRM_BUTTONS[confirmAction?.type ?? "reactivate"]}
                      isPending={isRevoking || isReactivating || isDeleting}
                      onPress={handleConfirm}
                    >
                      {confirmAction
                        ? t(`${confirmAction.type}Modal.confirm`)
                        : tActions("confirm")}
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
