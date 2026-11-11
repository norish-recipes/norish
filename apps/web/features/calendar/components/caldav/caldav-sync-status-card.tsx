"use client";

import type { ComponentProps } from "react";
import { useState } from "react";
import { slotTranslationKeys } from "@/components/dashboard/today/todays-meals-constants";
import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton } from "@/components/shared/action-button";
import { ChipButton } from "@/components/shared/chip-button";
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { Button, Chip, Pagination, Popover, Table } from "@heroui/react";
import { useFormatter, useNow, useTranslations } from "next-intl";

import type { Slot } from "@norish/shared/contracts";
import type { CaldavSyncStatus } from "@norish/shared/contracts/dto/caldav-sync-status";
import {
  useCaldavMutations,
  useCaldavSummaryQuery,
  useCaldavSyncStatusQuery,
} from "@norish/shared-react/calendar";
import { useHydrated } from "@norish/shared-react/platform";
import { caldavSyncStatuses } from "@norish/shared/contracts";

import { FIRST_SYNC_STATUS_PAGE } from "./first-sync-status-page";

const SYNC_STATUS_COLOR = {
  synced: "success",
  pending: "warning",
  failed: "danger",
  removed: "default",
} as const satisfies Record<CaldavSyncStatus, ComponentProps<typeof Chip>["color"]>;

const isSlot = (slot: string): slot is Slot => Object.hasOwn(slotTranslationKeys, slot);

export default function CaldavSyncStatusCard() {
  const t = useTranslations("settings.caldav.syncStatus");
  const tSlots = useTranslations("common.slots");
  const tItemTypes = useTranslations("calendar.timeline");
  const tStatus = useTranslations("common.status");
  const { pageSize } = FIRST_SYNC_STATUS_PAGE;
  const [syncStatusPage, setSyncStatusPage] = useState<number>(FIRST_SYNC_STATUS_PAGE.page);
  const [syncStatusFilter, setSyncStatusFilter] = useState<CaldavSyncStatus | undefined>(
    FIRST_SYNC_STATUS_PAGE.statusFilter
  );
  const {
    statuses: syncStatuses,
    total: syncStatusTotal,
    isLoading,
    isPlaceholderData,
  } = useCaldavSyncStatusQuery({
    page: syncStatusPage,
    pageSize,
    statusFilter: syncStatusFilter,
  });
  const { summary: syncStatusSummary } = useCaldavSummaryQuery();
  const { triggerSync, isTriggeringSync: syncing } = useCaldavMutations();
  const format = useFormatter();
  // relativeTime needs a clock; this one moves on each minute.
  const now = useNow({ updateInterval: 60_000 });
  const hydrated = useHydrated();
  const handleFilterClick = (status: CaldavSyncStatus) => {
    setSyncStatusFilter(syncStatusFilter === status ? undefined : status);
    setSyncStatusPage(1);
  };
  const formatDate = (lastSyncAt: Date | string | null | undefined) => {
    if (!lastSyncAt) return "—";
    try {
      // "3 minutes ago" only once hydrated: the server's clock is not the browser's.
      if (!hydrated) return format.dateTime(new Date(lastSyncAt));

      return format.relativeTime(new Date(lastSyncAt), now);
    } catch {
      return "—";
    }
  };
  const totalPages = Math.ceil(syncStatusTotal / pageSize);
  const startIndex = (syncStatusPage - 1) * pageSize + 1;
  const endIndex = Math.min(syncStatusPage * pageSize, syncStatusTotal);

  return (
    <SettingsCard
      actions={
        <ActionButton
          action="apply"
          icon={ArrowPathIcon}
          isPending={syncing}
          size="sm"
          onPress={triggerSync}
        >
          {t("syncNow")}
        </ActionButton>
      }
      icon={ClockIcon}
      title={t("title")}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {caldavSyncStatuses.map((status) => (
            <ChipButton
              key={status}
              aria-pressed={syncStatusFilter === status}
              className="cursor-pointer transition-all"
              color={SYNC_STATUS_COLOR[status]}
              size="sm"
              variant={syncStatusFilter === status ? "primary" : "soft"}
              onClick={() => handleFilterClick(status)}
            >
              {t(`statuses.${status}`)}: {syncStatusSummary[status]}
            </ChipButton>
          ))}
        </div>

        <div className="flex items-center justify-between">
          {syncStatusFilter ? (
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => {
                setSyncStatusFilter(undefined);
                setSyncStatusPage(1);
              }}
            >
              <XMarkIcon className="size-4" />
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
      <Table
        aria-busy={isPlaceholderData}
        className={`p-0 transition-opacity ${isPlaceholderData ? "opacity-50" : ""}`}
      >
        <Table.ScrollContainer>
          <Table.Content aria-label={t("title")}>
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
                  {isLoading
                    ? tStatus("loading")
                    : syncStatusFilter
                      ? t("emptyFiltered", {
                          status: t(`statuses.${syncStatusFilter}`),
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
                    <Chip size="sm" variant="soft">
                      {tItemTypes(status.itemType)}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell className="text-sm">{status.date || "—"}</Table.Cell>
                  <Table.Cell className="text-sm">
                    {status.slot && isSlot(status.slot)
                      ? tSlots(slotTranslationKeys[status.slot])
                      : "—"}
                  </Table.Cell>
                  <Table.Cell>
                    <Chip color={SYNC_STATUS_COLOR[status.syncStatus]} size="sm" variant="soft">
                      {t(`statuses.${status.syncStatus}`)}
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
                            aria-label={t("errorDetails")}
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
          {/* Pagination holds no page state: this card's page drives Previous, Summary and Next. */}
          <Pagination aria-label={t("paginationLabel")} size="sm">
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
