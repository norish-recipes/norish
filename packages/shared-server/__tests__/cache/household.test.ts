// @vitest-environment node
/**
 * The household cache against a real Valkey: a fill that read the roster before a membership
 * change never writes it back over the change's invalidation.
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

it("serves the new household after an invalidation that lands while a fill reads the old one", async () => {
  let release!: (household: typeof OLD) => void;

  db.getHouseholdForUser.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  const fill = getCachedHouseholdForUser("user-1");

  await vi.waitFor(() => expect(db.getHouseholdForUser).toHaveBeenCalledOnce());
  await invalidateHouseholdCacheForUsers(["user-1"]);
  release(OLD);
  await expect(fill).resolves.toEqual(OLD);

  db.getHouseholdForUser.mockResolvedValue(NEW);
  await expect(getCachedHouseholdForUser("user-1")).resolves.toEqual(NEW);
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
