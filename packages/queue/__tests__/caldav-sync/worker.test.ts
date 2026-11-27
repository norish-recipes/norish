// @vitest-environment node
/**
 * A CalDAV job reads the entry's household when it runs, against the real plan: one queued
 * before its adder left syncs nothing, takes the event off their calendar and drops the status.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";
import { AccountGoneError } from "../../src/account-jobs";

const handlers = vi.hoisted(() => ({
  syncPlannedItem: vi.fn(async () => ({ uid: "event-1" })),
  deletePlannedItem: vi.fn(async () => undefined),
  truncateErrorMessage: (message: string) => message,
}));
const captured = vi.hoisted(() => ({
  processor: undefined as ((job: unknown) => Promise<unknown>) | undefined,
}));

vi.mock("bullmq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bullmq")>();

  class MockWorker {
    on = vi.fn();
    pause = vi.fn(async () => undefined);
    cancelAllJobs = vi.fn();
    close = vi.fn(async () => undefined);

    constructor(_queueName: string, processor: (job: unknown) => Promise<unknown>) {
      captured.processor = processor;
    }
  }

  return { ...actual, Worker: MockWorker };
});
vi.mock("@norish/queue/valkey/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/shared-server/realtime/caldav", () => ({ caldav: { publish: vi.fn() } }));

describe("the CalDAV sync worker", () => {
  const testBase = new RepositoryTestBase("test_caldav_sync_worker");
  let helpers: typeof import("../../../db/__tests__/helpers/db-test-helpers");
  let planned: typeof import("@norish/db/repositories/planned-items");
  let statuses: typeof import("@norish/db/repositories/caldav-sync-status");
  let households: typeof import("@norish/db/repositories/households");
  let worker: typeof import("@norish/queue/caldav-sync/worker");
  let closeWorkers: typeof import("@norish/queue/create-worker").closeWorkers;
  let member: string;
  let household: string;

  beforeAll(async () => {
    await testBase.setup();
    helpers = await import("../../../db/__tests__/helpers/db-test-helpers");
    planned = await import("@norish/db/repositories/planned-items");
    statuses = await import("@norish/db/repositories/caldav-sync-status");
    households = await import("@norish/db/repositories/households");
    worker = await import("@norish/queue/caldav-sync/worker");
    closeWorkers = (await import("@norish/queue/create-worker")).closeWorkers;
    (await import("@norish/queue/api-handlers")).registerQueueApiHandlers(handlers as never);
  });

  beforeEach(async () => {
    const [admin] = await testBase.beforeEachTest();

    handlers.syncPlannedItem.mockClear();
    handlers.deletePlannedItem.mockClear();
    member = (await helpers.createTestUser()).id;
    household = await helpers.joinTestHousehold(member, admin.id);
    worker.startCaldavSyncWorker();
  });

  afterEach(async () => {
    await closeWorkers(0);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function syncJob(recipeId?: string) {
    const entry = await planned.createPlannedItem({
      householdId: household,
      userId: member,
      date: "2999-01-01",
      slot: "Dinner",
      itemType: recipeId ? "recipe" : "note",
      title: recipeId ? null : "Soep",
      recipeId: recipeId ?? null,
    });
    const data = {
      recipeId,
      userId: member,
      itemId: entry.id,
      itemType: recipeId ? "recipe" : "note",
      plannedItemId: entry.id,
      eventTitle: "Soep",
      date: entry.date,
      slot: entry.slot,
      caldavServerUrl: "https://dav.example/",
    };

    return {
      entry,
      run: (operation: "sync" | "delete" = "sync") =>
        captured.processor!({
          id: "job-1",
          attemptsMade: 0,
          data: { ...data, operation },
          updateProgress: vi.fn(),
          log: vi.fn(async () => 0),
        }),
    };
  }

  it("syncs an entry of the household its adder is in", async () => {
    const { entry, run } = await syncJob();

    await run();

    expect(handlers.syncPlannedItem).toHaveBeenCalledOnce();
    expect(await statuses.getCaldavSyncStatusByItemId(member, entry.id)).toMatchObject({
      syncStatus: "synced",
    });
  });

  it("links the event to a recipe only while the account may view it when the job runs", async () => {
    const { setConfig } = await import("@norish/db/repositories/server-config");
    const { ServerConfigKeys } = await import("@norish/config/zod/server-config");
    const setView = (view: "everyone" | "household") =>
      setConfig(
        ServerConfigKeys.RECIPE_PERMISSION_POLICY,
        { view, edit: "household", delete: "household" },
        null,
        false
      );
    const theirs = await helpers.createTestRecipe((await helpers.createTestUser()).id);

    await setView("everyone");
    const { run } = await syncJob(theirs.id);

    // Queued while in view; view narrowed before it ran.
    await setView("household");
    await run();
    await setView("everyone");
    await run();

    expect(handlers.syncPlannedItem.mock.calls.map((call) => (call as unknown[])[5])).toEqual([
      undefined,
      theirs.id,
    ]);
  });

  it("takes an entry its adder left behind off their calendar, status and all", async () => {
    const { entry, run } = await syncJob();

    await run();
    await households.moveToHouseholdOfOne(household, member);
    await run();

    expect(handlers.syncPlannedItem).toHaveBeenCalledOnce();
    expect(handlers.deletePlannedItem).toHaveBeenCalledWith(member, entry.id);
    expect(await statuses.getCaldavSyncStatusByItemId(member, entry.id)).toBeNull();
  });

  it("keeps an entry on the calendar when its adder rejoined before the leave's removal ran", async () => {
    const { entry, run } = await syncJob();

    await run();
    await households.moveToHouseholdOfOne(household, member);
    await households.joinHousehold(member, { householdId: household });
    // The removal the leave queued runs now, with the entry the account's plan again.
    await run("delete");

    expect(handlers.deletePlannedItem).not.toHaveBeenCalled();
    expect(await statuses.getCaldavSyncStatusByItemId(member, entry.id)).toMatchObject({
      syncStatus: "synced",
    });
  });

  it("takes off an event it wrote while its adder left, keeping no status", async () => {
    const { entry, run } = await syncJob();

    handlers.syncPlannedItem.mockImplementationOnce(async () => {
      await households.moveToHouseholdOfOne(household, member);

      return { uid: "event-1" };
    });
    await run();

    expect(handlers.deletePlannedItem).toHaveBeenCalledWith(member, entry.id);
    expect(await statuses.getCaldavSyncStatusByItemId(member, entry.id)).toBeNull();
  });

  it("takes off an event it wrote when the account went meanwhile and no status can be saved", async () => {
    const { entry, run } = await syncJob();

    handlers.syncPlannedItem.mockImplementationOnce(async () => {
      await households.deleteAccount(member);

      return { uid: "event-1" };
    });
    await expect(run()).rejects.toThrow();

    expect(handlers.deletePlannedItem).toHaveBeenCalledWith(member, entry.id);
  });

  it("records an entry that became a note as a note when it syncs again", async () => {
    const recipe = await helpers.createTestRecipe(member);
    const { entry, run } = await syncJob(recipe.id);

    await run();
    const job = (itemType: string) => ({
      id: "job-2",
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        userId: member,
        itemId: entry.id,
        itemType,
        plannedItemId: entry.id,
        eventTitle: "Soep",
        date: entry.date,
        slot: entry.slot,
        operation: "sync",
        caldavServerUrl: "https://dav.example/",
      },
      updateProgress: vi.fn(),
      log: vi.fn(async () => 0),
    });

    await captured.processor!(job("note"));
    expect(await statuses.getCaldavSyncStatusByItemId(member, entry.id)).toMatchObject({
      itemType: "note",
    });
    await worker.handleCaldavJobFailed(job("recipe") as never, new Error("Server down"));
    expect(await statuses.getCaldavSyncStatusByItemId(member, entry.id)).toMatchObject({
      itemType: "recipe",
    });
  });

  it("records no failure for an account deleted before its job failed", async () => {
    const { entry } = await syncJob();

    await households.deleteAccount(member);

    await expect(
      worker.handleCaldavJobFailed(
        {
          id: "job-1",
          attemptsMade: 1,
          opts: { attempts: 3 },
          data: { userId: member, itemId: entry.id },
        } as never,
        new AccountGoneError()
      )
    ).resolves.toBeUndefined();
  });
});
