// @vitest-environment node
/**
 * CalDAV bulk sync against the real plan of two households: a member's calendar carries the
 * entries they added to their current household's plan, and loses what they left behind.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

const addCaldavSyncJob = vi.hoisted(() => vi.fn());

vi.mock("@norish/db/repositories/caldav-config", () => ({
  getCaldavConfigDecrypted: async () => ({ enabled: true, serverUrl: "https://dav.example/" }),
}));
vi.mock("@norish/queue/caldav-sync/producer", () => ({ addCaldavSyncJob }));
vi.mock("@norish/queue/registry", () => ({ getQueues: () => ({ caldavSync: {} }) }));

describe("CalDAV bulk sync across households", () => {
  const testBase = new RepositoryTestBase("test_caldav_sync_households");
  let helpers: typeof import("../../../db/__tests__/helpers/db-test-helpers");
  let planned: typeof import("@norish/db/repositories/planned-items");
  let statuses: typeof import("@norish/db/repositories/caldav-sync-status");
  let households: typeof import("@norish/db/repositories/households");
  let sync: typeof import("../../src/routers/caldav/sync-service");
  let member: string;
  let housemate: string;
  let household: string;

  beforeAll(async () => {
    await testBase.setup();
    helpers = await import("../../../db/__tests__/helpers/db-test-helpers");
    planned = await import("@norish/db/repositories/planned-items");
    statuses = await import("@norish/db/repositories/caldav-sync-status");
    households = await import("@norish/db/repositories/households");
    sync = await import("../../src/routers/caldav/sync-service");
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    addCaldavSyncJob.mockReset();
    housemate = user.id;
    member = (await helpers.createTestUser()).id;
    household = await helpers.joinTestHousehold(member, housemate);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const entry = (userId: string, title: string, date = "2999-01-01") =>
    planned.createPlannedItem({
      householdId: household,
      userId,
      date,
      slot: "Dinner",
      itemType: "note",
      title,
    });
  const queued = () =>
    addCaldavSyncJob.mock.calls.map(([, job]) => ({ itemId: job.itemId, op: job.operation }));

  it("queues the member's own future entries of their household, nobody else's", async () => {
    const mine = await entry(member, "Soep");

    await entry(housemate, "Pasta");
    await entry(member, "Gisteren", "2000-01-01");

    await sync.syncAllFutureItems(member, household);

    expect(queued()).toEqual([{ itemId: mine.id, op: "sync" }]);
  });

  it("queues nothing of a household the member left, and chases its entries off the calendar", async () => {
    const mine = await entry(member, "Soep");

    await statuses.createCaldavSyncStatus({
      userId: member,
      itemId: mine.id,
      itemType: "note",
      plannedItemId: mine.id,
      eventTitle: "Soep",
      syncStatus: "failed",
      caldavEventUid: null,
      retryCount: 1,
      errorMessage: null,
      lastSyncAt: new Date(),
    });
    await households.moveToHouseholdOfOne(household, member);
    const own = await helpers.householdIdOf(member);

    await sync.syncAllFutureItems(member, own);
    expect(queued()).toEqual([]);

    await sync.retryFailedSyncs(member, own);
    expect(queued()).toEqual([{ itemId: mine.id, op: "delete" }]);
  });

  /** A status of the member's for an entry of the household they are in now. */
  async function synced(userId: string, title: string) {
    const item = await entry(userId, title);

    await statuses.createCaldavSyncStatus({
      userId,
      itemId: item.id,
      itemType: "note",
      plannedItemId: item.id,
      eventTitle: title,
      syncStatus: "synced",
      caldavEventUid: `uid-${item.id}`,
      retryCount: 0,
      errorMessage: null,
      lastSyncAt: new Date(),
    });

    return item;
  }

  it("shows a former member no date or slot of the household they left", async () => {
    const left = await synced(member, "Soep");

    await households.moveToHouseholdOfOne(household, member);

    const { items } = await statuses.getCaldavSyncStatusesByUser(member);

    expect(items).toEqual([expect.objectContaining({ itemId: left.id, date: null, slot: null })]);
  });

  it("on leaving, takes only the left household's synced entries off the calendar", async () => {
    const left = await synced(member, "Soep");

    await households.moveToHouseholdOfOne(household, member);
    household = await helpers.householdIdOf(member);
    await synced(member, "Eigen");

    await sync.chaseLeftBehindEvents(member);

    expect(queued()).toEqual([{ itemId: left.id, op: "delete" }]);
  });
});
