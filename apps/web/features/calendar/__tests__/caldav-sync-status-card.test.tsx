import { act } from "react";
import CaldavSyncStatusCard from "@/features/calendar/components/caldav/caldav-sync-status-card";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString(),
    relativeTime: (date: Date, now: Date) =>
      `${Math.round((now.getTime() - date.getTime()) / 60_000)} minutes ago`,
  }),
  useNow: () => new Date(),
}));

vi.mock("@norish/shared-react/calendar", () => ({
  useCaldavSyncStatusQuery: () => ({
    statuses: [
      {
        id: "s1",
        recipeName: "Synced Soup",
        itemType: "recipe",
        date: "2026-10-17",
        slot: "Dinner",
        syncStatus: "synced",
        lastSyncAt: "2026-10-17T10:00:00.000Z",
        errorMessage: null,
      },
    ],
    total: 1,
  }),
  useCaldavSummaryQuery: () => ({ summary: { pending: 0, synced: 1, failed: 0, removed: 0 } }),
  useCaldavMutations: () => ({ triggerSync: vi.fn(), isTriggeringSync: false }),
}));

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("CaldavSyncStatusCard", () => {
  it("hydrates a sync time the server drew, though the browser's clock has moved on", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-17T10:00:30Z"));
    const container = document.createElement("div");

    container.innerHTML = renderToString(<CaldavSyncStatusCard />);
    document.body.append(container);

    // A slow phone hydrates later: "less than a minute ago" has become "2 minutes ago".
    vi.setSystemTime(new Date("2026-10-17T10:02:00Z"));
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, <CaldavSyncStatusCard />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toContain("2 minutes ago");
  });

  it("names each row's type, meal and status in the reader's language", async () => {
    const container = document.createElement("div");

    document.body.append(container);
    await act(async () => createRoot(container).render(<CaldavSyncStatusCard />));

    const row = [...container.querySelectorAll('[role="row"]')].at(-1)?.textContent;

    expect(row).toContain("calendar.timeline.recipe");
    expect(row).toContain("common.slots.dinner");
    expect(row).toContain("settings.caldav.syncStatus.statuses.synced");
  });
});
