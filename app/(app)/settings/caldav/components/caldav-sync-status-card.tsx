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
  Pagination,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@heroui/react";
import { ArrowPathIcon, ClockIcon, InformationCircleIcon } from "@heroicons/react/24/solid";
import { formatDistanceToNow } from "date-fns";

import { useCalDavSettingsContext } from "../context";

export default function CalDavSyncStatusCard() {
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
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
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
      <CardHeader>
        <div className="flex w-full flex-col gap-4">
          {/* Title and Sync Button */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <ClockIcon className="text-primary h-6 w-6" />
              <h2 className="text-lg font-semibold">Sync Status</h2>
            </div>
            <Button
              color="primary"
              isLoading={syncing}
              size="sm"
              startContent={<ArrowPathIcon className="h-4 w-4" />}
              onPress={handleManualSync}
            >
              Sync Now
            </Button>
          </div>

          {/* Summary Badges - Clickable Filters */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Chip
                className="cursor-pointer transition-all"
                color="success"
                size="sm"
                variant={syncStatusFilter === "synced" ? "solid" : "flat"}
                onClick={() => handleFilterClick("synced")}
              >
                Synced: {syncStatusSummary.synced}
              </Chip>
              <Chip
                className="cursor-pointer transition-all"
                color="warning"
                size="sm"
                variant={syncStatusFilter === "pending" ? "solid" : "flat"}
                onClick={() => handleFilterClick("pending")}
              >
                Pending: {syncStatusSummary.pending}
              </Chip>
              <Chip
                className="cursor-pointer transition-all"
                color="danger"
                size="sm"
                variant={syncStatusFilter === "failed" ? "solid" : "flat"}
                onClick={() => handleFilterClick("failed")}
              >
                Failed: {syncStatusSummary.failed}
              </Chip>
              <Chip
                className="cursor-pointer transition-all"
                color="default"
                size="sm"
                variant={syncStatusFilter === "removed" ? "solid" : "flat"}
                onClick={() => handleFilterClick("removed")}
              >
                Removed: {syncStatusSummary.removed}
              </Chip>
            </div>

            {/* Filter Status and Count */}
            <div className="flex items-center justify-between">
              {syncStatusFilter ? (
                <Button
                  className="h-8"
                  size="sm"
                  variant="light"
                  onPress={() => {
                    setSyncStatusFilter(undefined);
                    setSyncStatusPage(1);
                  }}
                >
                  Clear filter
                </Button>
              ) : (
                <span className="text-default-400 text-base">Click a badge to filter</span>
              )}
              {syncStatusTotal > 0 && (
                <p className="text-default-500 text-base">
                  Showing {startIndex}-{endIndex} of {syncStatusTotal} items
                </p>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardBody>
        <Table
          aria-label="CalDAV sync status"
          classNames={{
            wrapper: "p-0",
          }}
        >
          <TableHeader>
            <TableColumn>ITEM</TableColumn>
            <TableColumn>TYPE</TableColumn>
            <TableColumn>DATE</TableColumn>
            <TableColumn>MEAL</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn>LAST SYNC</TableColumn>
            <TableColumn>ERROR</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={
              syncStatusFilter ? `No ${syncStatusFilter} items found` : "No sync records found"
            }
          >
            {syncStatuses.map((status) => (
              <TableRow key={status.id}>
                <TableCell className="min-w-[150px] font-medium">
                  {status.recipeName || status.noteName || status.eventTitle || "—"}
                </TableCell>
                <TableCell>
                  <Chip className="capitalize" size="sm" variant="flat">
                    {status.itemType}
                  </Chip>
                </TableCell>
                <TableCell className="text-sm">{status.date || "—"}</TableCell>
                <TableCell className="text-sm capitalize">{status.slot || "—"}</TableCell>
                <TableCell>
                  <Chip
                    className="capitalize"
                    color={getStatusColor(status.syncStatus)}
                    size="sm"
                    variant="flat"
                  >
                    {status.syncStatus}
                  </Chip>
                </TableCell>
                <TableCell className="text-default-500 text-xs">
                  {formatDate(status.lastSyncAt)}
                </TableCell>
                <TableCell>
                  {status.errorMessage ? (
                    <Popover placement="left">
                      <PopoverTrigger>
                        <Button
                          isIconOnly
                          className="min-w-unit-8 w-unit-8 h-unit-8"
                          size="sm"
                          variant="light"
                        >
                          <InformationCircleIcon className="text-danger h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="max-w-xs">
                        <div className="px-1 py-2">
                          <div className="text-small mb-1 font-bold">Error Details</div>
                          <div className="text-tiny text-danger">{status.errorMessage}</div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className="text-default-400 text-xs">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
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
      </CardBody>
    </Card>
  );
}
