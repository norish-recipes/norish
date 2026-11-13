/**
 * While a page of sync statuses loads, the card keeps the last page of the same filter on
 * screen, marked busy; a new filter shows loading, never another filter's rows.
 */
import { readAnswers } from "@/__tests__/helpers/trpc-fake";
import CaldavSyncStatusCard from "@/features/calendar/components/caldav/caldav-sync-status-card";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import "@testing-library/jest-dom";

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useFormatter: () => ({ dateTime: () => "", relativeTime: () => "" }),
  useNow: () => new Date(),
}));

const ROW = {
  id: "s1",
  recipeName: "Pending Pie",
  itemType: "recipe",
  date: "2026-11-12",
  slot: "Dinner",
  syncStatus: "pending",
  lastSyncAt: null,
  errorMessage: null,
};

describe("CaldavSyncStatusCard while a page loads", () => {
  beforeEach(() => {
    readAnswers.clear();
    readAnswers.set("caldav.getSummary", async () => ({
      pending: 130,
      synced: 0,
      failed: 0,
      removed: 0,
    }));
    // Only the first page of pending answers; any other stays loading.
    readAnswers.set("caldav.getSyncStatus", (input) => {
      const { page, statusFilter } = input as { page: number; statusFilter?: string };

      return page === 1 && statusFilter === "pending"
        ? Promise.resolve({ statuses: [ROW], total: 130, page: 1, pageSize: 20 })
        : new Promise(() => {});
    });
    render(<CaldavSyncStatusCard />, { wrapper: createTestWrapper(createTestQueryClient()) });
  });

  it("keeps the last page, marked busy, while the next page loads", async () => {
    await screen.findByText("Pending Pie");

    // Previous and Next carry only an icon.
    fireEvent.click(document.querySelector('[data-slot="pagination-next"]')!);

    expect(screen.getByText("Pending Pie")).toBeInTheDocument();
    expect(screen.getByRole("grid").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
  });

  it("shows loading, not the last filter's rows, while another filter loads", async () => {
    await screen.findByText("Pending Pie");

    fireEvent.click(screen.getByText(/settings\.caldav\.syncStatus\.statuses\.failed/));

    expect(screen.queryByText("Pending Pie")).not.toBeInTheDocument();
    expect(screen.queryByText(/emptyFiltered/)).not.toBeInTheDocument();
    expect(screen.getByText("common.status.loading")).toBeInTheDocument();
  });
});
