"use client";

import { useState } from "react";
import NewFeatureChip from "@/app/(app)/settings/components/new-feature-chip";
import RecipeShareStatusChip from "@/components/recipes/recipe-share-status-chip";
import { sharedRecipeShareHooks } from "@/hooks/recipes/shared-recipe-hooks";
import { PauseIcon, PlayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button, Card, Modal, Table } from "@heroui/react";
import { useTranslations } from "next-intl";

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
function formatDate(date: Date | null) {
  return date ? new Date(date).toLocaleString() : "-";
}
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
  const tCommon = useTranslations("common");
  const tActions = useTranslations("common.actions");
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
              <Button
                isIconOnly
                aria-label={t("revokeModal.title")}
                size="sm"
                onPress={() =>
                  setConfirmAction({
                    share,
                    type: "revoke",
                  })
                }
                variant="tertiary"
              >
                <PauseIcon className="h-4 w-4" />
              </Button>
            ) : null}
            {share.status === "revoked" ? (
              <Button
                isIconOnly
                aria-label={t("reactivateModal.title")}
                size="sm"
                onPress={() =>
                  setConfirmAction({
                    share,
                    type: "reactivate",
                  })
                }
                variant="tertiary"
              >
                <PlayIcon className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              isIconOnly
              aria-label={t("deleteModal.title")}
              size="sm"
              onPress={() =>
                setConfirmAction({
                  share,
                  type: "delete",
                })
              }
              variant="danger-soft"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        );
    }
  };
  return (
    <>
      <Card>
        <Card.Header>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {t("title")}
            <NewFeatureChip showOnVersion="0.18.0" />
          </h2>
        </Card.Header>
        <Card.Content className="gap-4">
          <p className="text-muted text-base">{t("description")}</p>

          {shares.length === 0 ? (
            <div className="bg-surface-secondary text-muted rounded-lg px-4 py-6 text-center text-sm">
              {isLoading ? tCommon("status.loading") : "None"}
            </div>
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
        </Card.Content>
      </Card>
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
                  <Button onPress={onClose} variant="tertiary">
                    {tActions("cancel")}
                  </Button>
                  <Button
                    onPress={handleConfirm}
                    isPending={isRevoking || isReactivating || isDeleting}
                  >
                    {confirmAction ? t(`${confirmAction.type}Modal.confirm`) : tActions("confirm")}
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
