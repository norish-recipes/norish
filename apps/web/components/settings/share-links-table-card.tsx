"use client";

import { useState } from "react";
import RecipeShareStatusChip from "@/components/recipes/recipe-share-status-chip";
import NewFeatureChip from "@/components/settings/new-feature-chip";
import { SettingsCard } from "@/components/settings/settings-card";
import { SkeletonRows } from "@/components/settings/settings-skeleton";
import { ActionButton, IconActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { EmptyState } from "@/components/shared/empty-state";
import { PauseIcon, PlayIcon } from "@heroicons/react/16/solid";
import { LinkIcon } from "@heroicons/react/24/outline";
import { Chip, Table } from "@heroui/react";
import { useFormatter, useTranslations } from "next-intl";

import type { ShareLinkMutations } from "@norish/shared-react/recipes";
import type {
  AdminRecipeShareInventoryDto,
  RecipeShareInventoryDto,
} from "@norish/shared/contracts/dto/recipe-shares";
import { shareLinkActions } from "@norish/shared-react/recipes";

type ShareRow = RecipeShareInventoryDto | AdminRecipeShareInventoryDto;
type ConfirmAction = {
  share: ShareRow;
  type: "revoke" | "reactivate" | "delete";
} | null;
type Props = {
  namespace: "settings.user.shareLinks" | "settings.admin.shareLinks";
  shares: ShareRow[];
  isLoading: boolean;
  mutations: ShareLinkMutations;
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
  mutations,
  showOwner = false,
}: Props) {
  const t = useTranslations(namespace);
  const tActions = useTranslations("common.actions");
  const format = useFormatter();
  const formatDate = (date: Date | null) =>
    date ? format.dateTime(new Date(date), DATE_AND_TIME) : "-";
  const { revokeShare, reactivateShare, deleteShare, isRevoking, isReactivating, isDeleting } =
    mutations;
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
        // An active link whose maker may no longer view the recipe does not open.
        return hasOwnerFields(share) && share.status === "active" && !share.makerMayView ? (
          <Chip size="sm" variant="soft">
            {t("inactive")}
          </Chip>
        ) : (
          <RecipeShareStatusChip status={share.status} />
        );
      case "created":
        return formatDate(share.createdAt);
      case "expires":
        return formatDate(share.expiresAt);
      case "actions":
        return (
          <div className="flex gap-1">
            {shareLinkActions(share).includes("revoke") ? (
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
            {shareLinkActions(share).includes("reactivate") ? (
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
        empty={
          !isLoading && shares.length === 0 ? (
            <EmptyState icon={LinkIcon} title={t("empty")} />
          ) : undefined
        }
        icon={LinkIcon}
        title={t("title")}
      >
        {isLoading ? (
          // The tab skeleton's row for this card.
          <SkeletonRows count={1} />
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
      <ConfirmModal
        confirm={
          <ActionButton
            {...CONFIRM_BUTTONS[confirmAction?.type ?? "reactivate"]}
            isPending={isRevoking || isReactivating || isDeleting}
            onPress={handleConfirm}
          >
            {confirmAction ? t(`${confirmAction.type}Modal.confirm`) : tActions("confirm")}
          </ActionButton>
        }
        isOpen={!!confirmAction}
        title={confirmAction ? t(`${confirmAction.type}Modal.title`) : ""}
        onOpenChange={() => setConfirmAction(null)}
      >
        <p>
          {confirmAction
            ? t(`${confirmAction.type}Modal.message`, {
                recipeName: confirmAction.share.recipeName,
              })
            : ""}
        </p>
      </ConfirmModal>
    </>
  );
}
