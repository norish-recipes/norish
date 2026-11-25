// @vitest-environment node
/**
 * The household cache against a real Valkey: a fill that read the roster before a membership
 * change is never served after the change's invalidation.
 */
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import {
  getCachedHouseholdForUser,
  invalidateHouseholdCacheForUsers,
} from "../../src/cache/household";
import { closeValkeyConnections, getPublisherClient } from "../../src/valkey/client";
import { startValkey, valkeyUrl } from "../helpers/valkey";

const config = vi.hoisted(() => ({ url: "" }));
const db = vi.hoisted(() => ({ getHouseholdForUser: vi.fn() }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    get VALKEY_URL() {
      return config.url;
    },
  },
}));
vi.mock("@norish/db/repositories/households", () => db);

const OLD = { id: "old-household" };
const NEW = { id: "new-household" };

let container: StartedValkeyContainer;

beforeAll(async () => {
  container = await startValkey();
  config.url = valkeyUrl(container);
});

beforeEach(async () => {
  await (await getPublisherClient()).flushall();
  db.getHouseholdForUser.mockReset();
});

afterAll(async () => {
  await closeValkeyConnections();
  await container?.stop();
});

/** Holds the next database read open until the returned release is called. */
function stallNextRead() {
  let release!: (household: typeof OLD) => void;

  db.getHouseholdForUser.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );

  return (household: typeof OLD) => release(household);
}

it("never serves a fill that read before an invalidation, however long it stalls", async () => {
  const release = stallNextRead();
  const fill = getCachedHouseholdForUser("user-1");

  await vi.waitFor(() => expect(db.getHouseholdForUser).toHaveBeenCalledOnce());
  await invalidateHouseholdCacheForUsers(["user-1"]);
  // Whatever the invalidation left has expired by the time the stalled fill writes.
  await (await getPublisherClient()).del("norish:cache:household:user:user-1");
  release(OLD);
  await expect(fill).resolves.toEqual(OLD);

  db.getHouseholdForUser.mockResolvedValue(NEW);
  await expect(getCachedHouseholdForUser("user-1")).resolves.toEqual(NEW);
});

it("serves the newer of two fills when the older one writes last", async () => {
  const release = stallNextRead();
  const older = getCachedHouseholdForUser("user-1");

  await vi.waitFor(() => expect(db.getHouseholdForUser).toHaveBeenCalledOnce());
  await invalidateHouseholdCacheForUsers(["user-1"]);
  db.getHouseholdForUser.mockResolvedValue(NEW);
  await expect(getCachedHouseholdForUser("user-1")).resolves.toEqual(NEW);
  release(OLD);
  await older;

  await expect(getCachedHouseholdForUser("user-1")).resolves.toEqual(NEW);
});

it("fills and caches after an invalidation that found no entry", async () => {
  await invalidateHouseholdCacheForUsers(["user-1"]);
  db.getHouseholdForUser.mockResolvedValue(NEW);

  await expect(getCachedHouseholdForUser("user-1")).resolves.toEqual(NEW);
  await expect(getCachedHouseholdForUser("user-1")).resolves.toEqual(NEW);
  expect(db.getHouseholdForUser).toHaveBeenCalledOnce();
});

it("caches a read and drops it on invalidation", async () => {
  db.getHouseholdForUser.mockResolvedValue(OLD);
  await getCachedHouseholdForUser("user-1");
  await getCachedHouseholdForUser("user-1");
  expect(db.getHouseholdForUser).toHaveBeenCalledOnce();

  await invalidateHouseholdCacheForUsers(["user-1"]);
  db.getHouseholdForUser.mockResolvedValue(NEW);

  await expect(getCachedHouseholdForUser("user-1")).resolves.toEqual(NEW);
});
