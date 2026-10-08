import { OfflineBootstrap } from "@/app/~offline/offline-bootstrap";
import { cacheManager } from "@/lib/query-cache";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/query-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/query-cache")>()),
  cacheManager: { reconcileIdentity: vi.fn() },
}));

vi.mock("@/app/(app)/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/dashboard", () => ({
  Dashboard: () => <div>dashboard-surface</div>,
}));

vi.mock("@/app/(app)/groceries/groceries-screen", () => ({
  GroceriesScreen: () => <div>groceries-surface</div>,
}));

vi.mock("@/app/(app)/calendar/page", () => ({
  default: () => <div>calendar-surface</div>,
}));

vi.mock("@/app/~offline/offline-recipe-detail", () => ({
  OfflineRecipeDetail: ({ id }: { id: string }) => <div>recipe-surface:{id}</div>,
}));

vi.mock("@/app/~offline/offline-unavailable", () => ({
  OfflineUnavailable: () => <div>offline-unavailable</div>,
}));

function renderPath(pathname: string) {
  window.history.replaceState(null, "", pathname);
  render(<OfflineBootstrap />);
}

describe("OfflineBootstrap", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    vi.mocked(cacheManager.reconcileIdentity).mockReset().mockResolvedValue(undefined);
  });

  it("restores the last reader's cache before drawing any surface", async () => {
    let restore!: () => void;

    vi.mocked(cacheManager.reconcileIdentity).mockReturnValue(
      new Promise<void>((resolve) => (restore = resolve))
    );
    renderPath("/groceries");

    await act(async () => {});
    expect(cacheManager.reconcileIdentity).toHaveBeenCalledWith({
      sessionUserId: null,
      isOffline: true,
    });
    expect(screen.queryByText("groceries-surface")).not.toBeInTheDocument();

    await act(async () => restore());
    expect(screen.getByText("groceries-surface")).toBeInTheDocument();
  });

  it.each([
    ["/", "dashboard-surface"],
    ["/groceries/", "groceries-surface"],
    ["/calendar", "calendar-surface"],
    [
      "/recipes/11111111-1111-4111-8111-111111111111/",
      "recipe-surface:11111111-1111-4111-8111-111111111111",
    ],
  ])("renders the warmed Offline surface for %s", async (pathname, expected) => {
    renderPath(pathname);

    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it.each([
    "/recipes/new",
    "/recipes/11111111-1111-4111-8111-111111111111/edit",
    "/settings",
    "/~offline",
  ])("renders Offline unavailable for unsupported path %s", async (pathname) => {
    renderPath(pathname);

    expect(await screen.findByText("offline-unavailable")).toBeInTheDocument();
  });
});
