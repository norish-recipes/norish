import { act } from "react";
import CalDavSyncStatusCard from "@/app/(app)/settings/caldav/components/caldav-sync-status-card";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: (date: Date) => date.toISOString() }),
}));

vi.mock("@/app/(app)/settings/caldav/context", () => ({
  useCalDavSettingsContext: () => ({
    syncStatuses: [
      {
        id: "s1",
        recipeName: "Synced Soup",
        itemType: "recipe",
        date: "2026-10-17",
        slot: "dinner",
        syncStatus: "synced",
        lastSyncAt: "2026-10-17T10:00:00.000Z",
        errorMessage: null,
      },
    ],
    syncStatusPage: 1,
    syncStatusTotal: 1,
    syncStatusSummary: { pending: 0, synced: 1, failed: 0, removed: 0 },
    setSyncStatusPage: vi.fn(),
    syncStatusFilter: undefined,
    setSyncStatusFilter: vi.fn(),
    triggerManualSync: vi.fn(),
    isTriggeringSync: false,
  }),
}));

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("CalDavSyncStatusCard", () => {
  it("hydrates a sync time the server drew, though the browser's clock has moved on", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-17T10:00:30Z"));
    const container = document.createElement("div");

    container.innerHTML = renderToString(<CalDavSyncStatusCard />);
    document.body.append(container);

    // A slow phone hydrates later: "less than a minute ago" has become "2 minutes ago".
    vi.setSystemTime(new Date("2026-10-17T10:02:00Z"));
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, <CalDavSyncStatusCard />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toContain("2 minutes ago");
  });
});
