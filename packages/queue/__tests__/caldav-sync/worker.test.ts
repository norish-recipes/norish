// @vitest-environment node
/**
 * A CalDAV job reads the entry's household when it runs, against the real plan: one queued
 * before its adder left syncs nothing, takes the event off their calendar and drops the status.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

const handlers = vi.hoisted(() => ({
  syncPlannedItem: vi.fn(async () => ({ uid: "event-1" })),
  deletePlannedItem: vi.fn(async () => undefined),
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

  async function syncJob() {
    const entry = await planned.createPlannedItem({
      householdId: household,
      userId: member,
      date: "2999-01-01",
      slot: "Dinner",
      itemType: "note",
      title: "Soep",
    });
    const data = {
      userId: member,
      itemId: entry.id,
      itemType: "note",
      plannedItemId: entry.id,
      eventTitle: "Soep",
      date: entry.date,
      slot: entry.slot,
      operation: "sync",
      caldavServerUrl: "https://dav.example/",
    };

    return {
      entry,
      run: () =>
        captured.processor!({
          id: "job-1",
          attemptsMade: 0,
          data,
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

  it("takes an entry its adder left behind off their calendar, status and all", async () => {
    const { entry, run } = await syncJob();

    await run();
    await households.moveToHouseholdOfOne(household, member);
    await run();

    expect(handlers.syncPlannedItem).toHaveBeenCalledOnce();
    expect(handlers.deletePlannedItem).toHaveBeenCalledWith(member, entry.id);
    expect(await statuses.getCaldavSyncStatusByItemId(member, entry.id)).toBeNull();
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
});
