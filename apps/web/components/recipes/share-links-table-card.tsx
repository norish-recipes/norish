"use client";

import { useState } from "react";
import NewFeatureChip from "@/app/(app)/settings/components/new-feature-chip";
import RecipeShareStatusChip from "@/components/recipes/recipe-share-status-chip";
import { sharedRecipeShareHooks } from "@/hooks/recipes/shared-recipe-hooks";
import { PauseIcon, PlayIcon, TrashIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import type {
  AdminRecipeShareInventoryDto,
  RecipeShareInventoryDto,
} from "@norish/shared/contracts/dto/recipe-shares";

type ShareRow = RecipeShareInventoryDto | AdminRecipeShareInventoryDto;
type ConfirmAction = { share: ShareRow; type: "revoke" | "reactivate" | "delete" } | null;

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

  const columns: Array<{ key: ColumnKey; label: string }> = [
    { key: "recipe", label: t("table.recipe") },
    ...(showOwner ? [{ key: "owner" as const, label: t("table.owner") }] : []),
    { key: "status", label: t("table.status") },
    { key: "created", label: t("table.created") },
    { key: "expires", label: t("table.expires") },
    { key: "actions", label: t("table.actions") },
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
                color="warning"
                size="sm"
                variant="light"
                onPress={() => setConfirmAction({ share, type: "revoke" })}
              >
                <PauseIcon className="h-4 w-4" />
              </Button>
            ) : null}
            {share.status === "revoked" ? (
              <Button
                isIconOnly
                color="success"
                size="sm"
                variant="light"
                onPress={() => setConfirmAction({ share, type: "reactivate" })}
              >
                <PlayIcon className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              isIconOnly
              color="danger"
              size="sm"
              variant="light"
              onPress={() => setConfirmAction({ share, type: "delete" })}
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
        <CardHeader>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {t("title")}
            <NewFeatureChip showOnVersion="0.18.0" />
          </h2>
        </CardHeader>
        <CardBody className="gap-4">
          <p className="text-default-600 text-base">{t("description")}</p>

          <Table aria-label={t("title")}>
            <TableHeader columns={columns}>
              {(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}
            </TableHeader>
            <TableBody emptyContent={t("empty")} isLoading={isLoading} items={shares}>
              {(share) => (
                <TableRow key={share.id}>
                  {(columnKey) => (
                    <TableCell>{renderCell(share, columnKey as ColumnKey)}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Modal isOpen={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                {confirmAction ? t(`${confirmAction.type}Modal.title`) : ""}
              </ModalHeader>
              <ModalBody>
                <p>
                  {confirmAction
                    ? t(`${confirmAction.type}Modal.message`, {
                        recipeName: confirmAction.share.recipeName,
                      })
                    : ""}
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {tActions("cancel")}
                </Button>
                <Button
                  color={confirmAction?.type === "delete" ? "danger" : "primary"}
                  isLoading={isRevoking || isReactivating || isDeleting}
                  onPress={handleConfirm}
                >
                  {confirmAction ? t(`${confirmAction.type}Modal.confirm`) : tActions("confirm")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
