"use client";

import { useState } from "react";
import { ArrowPathIcon, ClockIcon, InformationCircleIcon } from "@heroicons/react/16/solid";
import { Button, Card, Chip, Pagination, Popover, Table } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";

import { useCalDavSettingsContext } from "../context";

export default function CalDavSyncStatusCard() {
  const t = useTranslations("settings.caldav.syncStatus");
  const {
    syncStatuses,
    syncStatusPage,
    syncStatusTotal,
    syncStatusSummary,
    setSyncStatusPage,
    syncStatusFilter,
    setSyncStatusFilter,
    triggerManualSync,
  } = useCalDavSettingsContext();
  const [syncing, setSyncing] = useState(false);
  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await triggerManualSync();
    } finally {
      setSyncing(false);
    }
  };
  const handleFilterClick = (status: "pending" | "synced" | "failed" | "removed") => {
    if (syncStatusFilter === status) {
      // Click same badge again to clear filter
      setSyncStatusFilter(undefined);
    } else {
      setSyncStatusFilter(status);
    }
    setSyncStatusPage(1); // Reset to first page
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case "synced":
        return "success";
      case "pending":
        return "warning";
      case "failed":
        return "danger";
      case "removed":
        return "default";
      default:
        return "default";
    }
  };
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "—";
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
      });
    } catch {
      return "—";
    }
  };
  const pageSize = 20;
  const totalPages = Math.ceil(syncStatusTotal / pageSize);
  const startIndex = (syncStatusPage - 1) * pageSize + 1;
  const endIndex = Math.min(syncStatusPage * pageSize, syncStatusTotal);
  return (
    <Card>
      <Card.Header>
        <div className="flex w-full flex-col gap-4">
          {/* Title and Sync Button */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <ClockIcon className="text-accent h-6 w-6" />
              <h2 className="text-lg font-semibold">{t("title")}</h2>
            </div>
            <Button
              size="sm"
              onPress={handleManualSync}
              variant="primary"
              isPending={syncing}
              className="min-w-16"
            >
              {<ArrowPathIcon className="h-4 w-4" />}
              {t("syncNow")}
            </Button>
          </div>

          {/* Summary Badges - Clickable Filters */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Chip
                as="button"
                aria-pressed={syncStatusFilter === "synced"}
                className="cursor-pointer transition-all"
                color="success"
                size="sm"
                variant={syncStatusFilter === "synced" ? "primary" : "soft"}
                type="button"
                onClick={() => handleFilterClick("synced")}
              >
                {t("statuses.synced")}: {syncStatusSummary.synced}
              </Chip>
              <Chip
                as="button"
                aria-pressed={syncStatusFilter === "pending"}
                className="cursor-pointer transition-all"
                color="warning"
                size="sm"
                variant={syncStatusFilter === "pending" ? "primary" : "soft"}
                type="button"
                onClick={() => handleFilterClick("pending")}
              >
                {t("statuses.pending")}: {syncStatusSummary.pending}
              </Chip>
              <Chip
                as="button"
                aria-pressed={syncStatusFilter === "failed"}
                className="cursor-pointer transition-all"
                color="danger"
                size="sm"
                variant={syncStatusFilter === "failed" ? "primary" : "soft"}
                type="button"
                onClick={() => handleFilterClick("failed")}
              >
                {t("statuses.failed")}: {syncStatusSummary.failed}
              </Chip>
              <Chip
                as="button"
                aria-pressed={syncStatusFilter === "removed"}
                className="cursor-pointer transition-all"
                color="default"
                size="sm"
                variant={syncStatusFilter === "removed" ? "primary" : "soft"}
                type="button"
                onClick={() => handleFilterClick("removed")}
              >
                {t("statuses.removed")}: {syncStatusSummary.removed}
              </Chip>
            </div>

            {/* Filter Status and Count */}
            <div className="flex items-center justify-between">
              {syncStatusFilter ? (
                <Button
                  className="h-8 min-w-16"
                  size="sm"
                  onPress={() => {
                    setSyncStatusFilter(undefined);
                    setSyncStatusPage(1);
                  }}
                  variant="tertiary"
                >
                  {t("clearFilter")}
                </Button>
              ) : (
                <span className="text-muted text-base">{t("clickToFilter")}</span>
              )}
              {syncStatusTotal > 0 && (
                <p className="text-muted text-base">
                  {t("showingItems", {
                    start: startIndex,
                    end: endIndex,
                    total: syncStatusTotal,
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card.Header>

      <Card.Content>
        <Table className="p-0">
          <Table.ScrollContainer>
            <Table.Content aria-label="CalDAV sync status">
              <Table.Header>
                <Table.Column id="item" isRowHeader>
                  {t("tableHeaders.item")}
                </Table.Column>
                <Table.Column id="type">{t("tableHeaders.type")}</Table.Column>
                <Table.Column id="date">{t("tableHeaders.date")}</Table.Column>
                <Table.Column id="meal">{t("tableHeaders.meal")}</Table.Column>
                <Table.Column id="status">{t("tableHeaders.status")}</Table.Column>
                <Table.Column id="lastSync">{t("tableHeaders.lastSync")}</Table.Column>
                <Table.Column id="error">{t("tableHeaders.error")}</Table.Column>
              </Table.Header>
              <Table.Body
                renderEmptyState={() => (
                  <div className="text-muted px-4 py-8 text-center text-sm">
                    {syncStatusFilter
                      ? t("emptyFiltered", {
                          status: syncStatusFilter,
                        })
                      : t("emptyDefault")}
                  </div>
                )}
              >
                {syncStatuses.map((status) => (
                  <Table.Row key={status.id} id={status.id}>
                    <Table.Cell className="min-w-[150px] font-medium">
                      {status.recipeName || status.noteName || status.eventTitle || "—"}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip className="capitalize" size="sm" variant="soft">
                        {status.itemType}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-sm">{status.date || "—"}</Table.Cell>
                    <Table.Cell className="text-sm capitalize">{status.slot || "—"}</Table.Cell>
                    <Table.Cell>
                      <Chip
                        className="capitalize"
                        color={getStatusColor(status.syncStatus)}
                        size="sm"
                        variant="soft"
                      >
                        {status.syncStatus}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-muted text-xs">
                      {formatDate(status.lastSyncAt)}
                    </Table.Cell>
                    <Table.Cell>
                      {status.errorMessage ? (
                        <Popover>
                          <Popover.Trigger>
                            <Button
                              isIconOnly
                              className="min-w-unit-8 w-unit-8 h-unit-8"
                              size="sm"
                              variant="tertiary"
                            >
                              <InformationCircleIcon className="text-danger h-4 w-4" />
                            </Button>
                          </Popover.Trigger>
                          <Popover.Content className="max-w-xs" placement="left">
                            <Popover.Dialog>
                              <div className="px-1 py-2">
                                <div className="mb-1 text-sm font-bold">{t("errorDetails")}</div>
                                <div className="text-danger text-xs">{status.errorMessage}</div>
                              </div>
                            </Popover.Dialog>
                          </Popover.Content>
                        </Popover>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center">
            <Pagination
              showControls
              page={syncStatusPage}
              size="sm"
              total={totalPages}
              onChange={setSyncStatusPage}
            />
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
