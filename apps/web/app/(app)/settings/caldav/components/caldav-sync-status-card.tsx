"use client";

import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { ChipButton } from "@/components/shared/chip-button";
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  InformationCircleIcon,
} from "@heroicons/react/16/solid";
import { Button, Chip, Pagination, Popover, Table } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { useFormatter, useTranslations } from "next-intl";

import { useHydrated } from "@norish/shared-react/hooks";

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
    isTriggeringSync: syncing,
  } = useCalDavSettingsContext();
  const format = useFormatter();
  const hydrated = useHydrated();
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
      // "3 minutes ago" only once hydrated: the server's clock is not the browser's.
      if (!hydrated) return format.dateTime(new Date(dateString));

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
    <SettingsCard
      actions={
        <Button
          className="min-w-16"
          isPending={syncing}
          size="sm"
          variant="primary"
          onPress={triggerManualSync}
        >
          {<ArrowPathIcon className="h-4 w-4" />}
          {t("syncNow")}
        </Button>
      }
      icon={ClockIcon}
      title={t("title")}
    >
      {/* Summary Badges - Clickable Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <ChipButton
            aria-pressed={syncStatusFilter === "synced"}
            className="cursor-pointer transition-all"
            color="success"
            size="sm"
            variant={syncStatusFilter === "synced" ? "primary" : "soft"}
            onClick={() => handleFilterClick("synced")}
          >
            {t("statuses.synced")}: {syncStatusSummary.synced}
          </ChipButton>
          <ChipButton
            aria-pressed={syncStatusFilter === "pending"}
            className="cursor-pointer transition-all"
            color="warning"
            size="sm"
            variant={syncStatusFilter === "pending" ? "primary" : "soft"}
            onClick={() => handleFilterClick("pending")}
          >
            {t("statuses.pending")}: {syncStatusSummary.pending}
          </ChipButton>
          <ChipButton
            aria-pressed={syncStatusFilter === "failed"}
            className="cursor-pointer transition-all"
            color="danger"
            size="sm"
            variant={syncStatusFilter === "failed" ? "primary" : "soft"}
            onClick={() => handleFilterClick("failed")}
          >
            {t("statuses.failed")}: {syncStatusSummary.failed}
          </ChipButton>
          <ChipButton
            aria-pressed={syncStatusFilter === "removed"}
            className="cursor-pointer transition-all"
            color="default"
            size="sm"
            variant={syncStatusFilter === "removed" ? "primary" : "soft"}
            onClick={() => handleFilterClick("removed")}
          >
            {t("statuses.removed")}: {syncStatusSummary.removed}
          </ChipButton>
        </div>

        {/* Filter Status and Count */}
        <div className="flex items-center justify-between">
          {syncStatusFilter ? (
            <Button
              className="h-8 min-w-16"
              size="sm"
              variant="tertiary"
              onPress={() => {
                setSyncStatusFilter(undefined);
                setSyncStatusPage(1);
              }}
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
      <Table className="p-0">
        <Table.ScrollContainer>
          <Table.Content aria-label="CalDAV sync status">
            <Table.Header>
              <Table.Column isRowHeader id="item">
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
          {/* Pagination is a "dumb" compound component (Root/Previous/
                Summary/Next) with no built-in state — no flat
                page/total/onChange API, so wire it up manually. */}
          <Pagination aria-label={t("title")} size="sm">
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={syncStatusPage === 1}
                  onPress={() => setSyncStatusPage(Math.max(1, syncStatusPage - 1))}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </Pagination.Previous>
              </Pagination.Item>
              <Pagination.Item>
                <Pagination.Summary>
                  {t("pagination", { current: syncStatusPage, total: totalPages })}
                </Pagination.Summary>
              </Pagination.Item>
              <Pagination.Item>
                <Pagination.Next
                  isDisabled={syncStatusPage === totalPages}
                  onPress={() => setSyncStatusPage(Math.min(totalPages, syncStatusPage + 1))}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </div>
      )}
    </SettingsCard>
  );
}
