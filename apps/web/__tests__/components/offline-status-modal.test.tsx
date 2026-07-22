import type { OfflineStatus } from "@/components/navbar/offline-status/use-offline-status";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { OfflineStatusModal } from "@/components/navbar/offline-status/offline-status-modal";

const h = vi.hoisted(() => ({
  status: {} as Record<string, unknown>,
}));

vi.mock("@/components/navbar/offline-status/use-offline-status", () => ({
  useOfflineStatus: () => h.status,
}));

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/lib/connectivity", () => ({
  OFFLINE_FORCED_AVAILABLE: true,
}));

vi.mock("@/components/Panel/Panel", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ relativeTime: () => "3 days ago" }),
}));

vi.mock("@heroui/react", () => ({
  Button: ({ children, onPress, isDisabled }: any) => (
    <button disabled={isDisabled} type="button" onClick={() => onPress?.()}>
      {children}
    </button>
  ),
  Modal: {
    Backdrop: ({ children, isOpen }: any) => (isOpen ? <div>{children}</div> : null),
    Container: ({ children }: any) => <div>{children}</div>,
    Dialog: ({ children }: any) => (
      <div>{typeof children === "function" ? children() : children}</div>
    ),
    Header: ({ children }: any) => <div>{children}</div>,
    Body: ({ children }: any) => <div>{children}</div>,
  },
}));

function makeStatus(overrides: Partial<OfflineStatus> = {}): Record<string, unknown> {
  return {
    posture: "live",
    isLive: true,
    isOffline: false,
    isForced: false,
    counts: { recipes: 12, groceries: 5, stores: 2, plannedThisWeek: 4 },
    lastWarmedAt: null,
    outbox: { entries: [], total: 0, pending: 0, parked: 0, conflicted: 0 },
    isReplaying: false,
    isSyncing: false,
    syncNow: vi.fn(async () => {}),
    retryAll: vi.fn(async () => {}),
    discardAll: vi.fn(async () => {}),
    wipeCache: vi.fn(async () => {}),
    setForcedOffline: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  h.status = makeStatus();
});

function renderModal() {
  return render(<OfflineStatusModal isOpen onOpenChange={() => {}} />);
}

describe("OfflineStatusModal", () => {
  it("renders connection, cache counts, outbox and the dev toggle", () => {
    renderModal();

    expect(screen.getByText("live")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument(); // recipes count
    expect(screen.getByText("empty")).toBeInTheDocument();
    expect(screen.getByText("force")).toBeInTheDocument(); // dev-only section
  });

  it("wipes the cache only after the inline confirm", async () => {
    renderModal();

    fireEvent.click(screen.getByText("wipe"));
    expect(h.status.wipeCache).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("wipeConfirm"));

    await waitFor(() => expect(h.status.wipeCache).toHaveBeenCalled());
    // The confirm box closes again after the action resolves.
    await waitFor(() => expect(screen.queryByText("wipeConfirm")).not.toBeInTheDocument());
  });

  it("discards the queue only after the inline confirm", async () => {
    h.status = makeStatus({
      outbox: {
        entries: [{ seq: 1, path: "groceries.create", status: "pending" }] as never,
        total: 1,
        pending: 1,
        parked: 0,
        conflicted: 0,
      },
    });

    renderModal();

    fireEvent.click(screen.getByText("discardAll"));
    expect(h.status.discardAll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("discardConfirm"));

    await waitFor(() => expect(h.status.discardAll).toHaveBeenCalled());
  });

  it("disables both confirm buttons while the confirmed action runs", async () => {
    let resolveWipe!: () => void;

    h.status = makeStatus({
      wipeCache: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveWipe = resolve;
          })
      ),
    });

    renderModal();

    fireEvent.click(screen.getByText("wipe"));
    fireEvent.click(screen.getByText("wipeConfirm"));

    expect(screen.getByText("wipeConfirm")).toBeDisabled();
    expect(screen.getByText("wipeCancel")).toBeDisabled();

    resolveWipe();
    await waitFor(() => expect(screen.queryByText("wipeConfirm")).not.toBeInTheDocument());
  });

  it("disables Sync now under the dev override", () => {
    h.status = makeStatus({
      posture: "offline-forced",
      isLive: false,
      isOffline: true,
      isForced: true,
    });

    renderModal();

    expect(screen.getByText("syncNow")).toBeDisabled();
  });
});
