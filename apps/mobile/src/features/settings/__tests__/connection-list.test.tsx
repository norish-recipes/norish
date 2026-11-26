// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/empty-card", () => ({ EmptyCard: () => null }));
vi.mock("../components/read-body", () => ({ ReadBody: () => null }));

const offline = vi.hoisted(() => ({ now: false }));

vi.mock("@/lib/offline/offline-now", () => ({ isOfflineNow: () => offline.now }));

const { ConnectionList } = await import("../components/connection-list");

const list = (read: { answered: boolean; refetch: () => void }) => (
  <ConnectionList
    count={0}
    emptyIcon="key-outline"
    emptyTitle="None"
    name="list"
    read={{ isLoading: false, error: null, ...read }}
  >
    {null}
  </ConnectionList>
);

describe("a connections page", () => {
  it("rereads a held list once when it opens, as a change made elsewhere has no event", () => {
    const refetch = vi.fn();
    const { rerender } = render(list({ answered: true, refetch }));

    rerender(list({ answered: true, refetch }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it("keeps the cached list Offline, without a reread", () => {
    offline.now = true;
    const refetch = vi.fn();

    render(list({ answered: true, refetch }));
    offline.now = false;

    expect(refetch).not.toHaveBeenCalled();
  });

  it("leaves a list never read to its own first read", () => {
    const refetch = vi.fn();

    render(list({ answered: false, refetch }));

    expect(refetch).not.toHaveBeenCalled();
  });
});
