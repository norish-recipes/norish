import { act } from "react";
import CaldavSyncStatusCard from "@/features/calendar/components/caldav/caldav-sync-status-card";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: object) =>
    values ? `${namespace}.${key} ${JSON.stringify(values)}` : `${namespace}.${key}`,
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString(),
    relativeTime: (date: Date, now: Date) =>
      `${Math.round((now.getTime() - date.getTime()) / 60_000)} minutes ago`,
  }),
  useNow: () => new Date(),
}));

const ROW = {
  id: "s1",
  recipeName: "Synced Soup",
  itemType: "recipe",
  date: "2026-10-17",
  slot: "Dinner",
  syncStatus: "synced",
  lastSyncAt: "2026-10-17T10:00:00.000Z",
  errorMessage: null,
};

type PageInput = { page: number; pageSize: number };
const answer = (input: PageInput, total: number) => ({
  statuses: [ROW],
  total,
  page: input.page,
  pageSize: input.pageSize,
  isLoading: false,
  isPlaceholderData: false,
});
const syncStatusQuery = vi.hoisted(() => vi.fn());

vi.mock("@norish/shared-react/calendar", () => ({
  useCaldavSyncStatusQuery: syncStatusQuery,
  useCaldavSummaryQuery: () => ({ summary: { pending: 0, synced: 1, failed: 0, removed: 0 } }),
  useCaldavMutations: () => ({ triggerSync: vi.fn(), isTriggeringSync: false }),
}));

beforeEach(() => {
  syncStatusQuery.mockImplementation((input: PageInput) => answer(input, 1));
});

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

  const renderCard = async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    document.body.append(container);
    await act(async () => root.render(<CaldavSyncStatusCard />));

    return {
      text: () => container.textContent,
      next: () =>
        act(async () =>
          container.querySelector<HTMLElement>('[data-slot="pagination-next"]')?.click()
        ),
      rerender: () => act(async () => root.render(<CaldavSyncStatusCard />)),
    };
  };

  it("labels the rows drawn while the next page loads, not the page asked for", async () => {
    syncStatusQuery.mockImplementation((input: PageInput) =>
      input.page === 1
        ? answer(input, 45)
        : { ...answer({ ...input, page: 1 }, 45), isPlaceholderData: true }
    );
    const card = await renderCard();

    await card.next();

    expect(syncStatusQuery).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(card.text()).toContain('showingItems {"start":1,"end":20,"total":45}');
    expect(card.text()).toContain('pagination {"current":1,"total":3}');
  });

  it("moves to the last page when the total shrinks below the page shown", async () => {
    let total = 45;

    syncStatusQuery.mockImplementation((input: PageInput) => answer(input, total));
    const card = await renderCard();

    await card.next();
    await card.next();
    expect(card.text()).toContain('pagination {"current":3,"total":3}');

    total = 35;
    await card.rerender();

    expect(syncStatusQuery).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(card.text()).toContain('showingItems {"start":21,"end":35,"total":35}');
    expect(card.text()).toContain('pagination {"current":2,"total":2}');
  });
});
