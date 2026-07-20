import type { WebSocket as PlaywrightWebSocket } from "@playwright/test";
import { expect, test } from "@/e2e/fixtures";
import { openOfflineStatus, warmPrimaryReadCache } from "@/e2e/support/cache";

test("shows cache inventory in the footer status modal with keyboard focus return", async ({
  page,
}) => {
  await warmPrimaryReadCache(page);
  await openOfflineStatus(page);
  const modal = page.getByRole("dialog");

  await expect(modal.locator("[data-development-simulator]")).toHaveCount(0);
  await expect(modal.getByText("Recipe summaries")).toBeVisible();
  await expect(modal.getByText("Calendar items")).toBeVisible();
  await expect(modal.getByText("Groceries", { exact: true })).toBeVisible();
  await expect(modal.getByText("Stores")).toBeVisible();
  await expect(modal.getByText("Schema 2")).toBeVisible();

  await modal.getByText("Close", { exact: true }).click();
  await expect(page.getByRole("button", { name: /^Offline status:/ })).toBeFocused();
});

test("@critical @development captures an optimistic mutation, diagnoses it, then replays before refetch", async ({
  page,
  api,
}) => {
  test.skip(
    process.env.NORISH_E2E_DEVELOPMENT !== "1",
    "The backend-unreachable simulator is development-only"
  );

  const subscriptionSockets = new Set<PlaywrightWebSocket>();
  const recoveryRequests: Array<{ method: string; path: string }> = [];

  page.on("websocket", (socket) => {
    if (new URL(socket.url()).pathname !== "/trpc") return;

    subscriptionSockets.add(socket);
    socket.on("close", () => subscriptionSockets.delete(socket));
  });
  page.on("request", (request) => {
    const url = new URL(request.url());

    if (!url.pathname.startsWith("/api/trpc/")) return;
    recoveryRequests.push({ method: request.method(), path: decodeURIComponent(url.pathname) });
  });
  const activeSubscriptionSocketCount = () =>
    [...subscriptionSockets].filter((socket) => !socket.isClosed()).length;
  const appSocketState = () =>
    page.evaluate(() => {
      const browserGlobal = globalThis as typeof globalThis & {
        __norishActiveWebSockets?: Set<WebSocket>;
        __norishWebConnectivityRuntime?: { isDegraded: () => boolean };
      };

      return {
        degraded: browserGlobal.__norishWebConnectivityRuntime?.isDegraded() ?? null,
        readyStates: [...(browserGlobal.__norishActiveWebSockets ?? [])].map(
          (socket) => socket.readyState
        ),
      };
    });

  await warmPrimaryReadCache(page);
  await expect.poll(activeSubscriptionSocketCount).toBeGreaterThan(0);
  await expect.poll(appSocketState).toEqual({ degraded: false, readyStates: [1] });
  await openOfflineStatus(page);
  let modal = page.getByRole("dialog");
  const simulation = modal.getByRole("switch", { name: "Simulate server unavailable" });
  const simulationControl = modal.locator(
    "[data-development-simulator] [data-slot='switch-control']"
  );

  await simulationControl.click();
  await expect(simulation).toBeChecked();
  await expect(modal.getByText("Server unavailable", { exact: true })).toBeVisible();
  await expect.poll(appSocketState).toEqual({ degraded: true, readyStates: [] });
  await expect.poll(activeSubscriptionSocketCount).toBe(0);

  const remoteName = "E2E remote websocket item";

  await api.groceries.create.mutate([
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: remoteName,
      unit: null,
      amount: 1,
      isDone: false,
      recipeIngredientId: null,
      recurringGroceryId: null,
      storeId: null,
    },
  ]);
  await page.waitForTimeout(500);
  await expect(page.getByText(remoteName, { exact: true })).toHaveCount(0);

  await modal.getByText("Close", { exact: true }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Add Item" }).click();
  const queuedName = "E2E queued onions";

  await page.getByPlaceholder("e.g., 2 lbs chicken breast").fill(queuedName);
  await page.getByPlaceholder("e.g., 2 lbs chicken breast").press("Enter");
  await expect(page.getByText(queuedName, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("dialog", { name: "Add Grocery" })).not.toBeVisible();

  await openOfflineStatus(page);
  modal = page.getByRole("dialog");
  await expect(modal.getByText("1 waiting")).toBeVisible();
  await expect(modal.getByText("No queued changes or retained results.")).toHaveCount(0);

  recoveryRequests.length = 0;
  await modal.locator("[data-development-simulator] [data-slot='switch-control']").click();
  await expect(
    modal.getByRole("switch", { name: "Simulate server unavailable" })
  ).not.toBeChecked();
  await expect(modal.getByText("Online")).toBeVisible();
  await expect.poll(activeSubscriptionSocketCount).toBeGreaterThan(0);
  await expect
    .poll(async () => {
      const groceries = await api.groceries.list.query();

      return groceries.groceries.some((grocery) => grocery.name === queuedName);
    })
    .toBe(true);
  await expect(modal.getByText("No queued changes or retained results.")).toBeVisible();
  await expect(modal.getByText("Data may be stale")).toHaveCount(0);
  await expect(page.getByText(remoteName, { exact: true })).toBeVisible();
  await expect(page.getByText(queuedName, { exact: true })).toBeVisible();

  const replayIndex = recoveryRequests.findIndex(
    (request) => request.method === "POST" && request.path.includes("groceries.create")
  );
  const authoritativeRefetchIndex = recoveryRequests.findIndex(
    (request) => request.method === "GET" && request.path.includes("groceries.list")
  );

  expect(replayIndex).toBeGreaterThanOrEqual(0);
  expect(authoritativeRefetchIndex).toBeGreaterThan(replayIndex);
});
