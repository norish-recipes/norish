// @vitest-environment node
/**
 * The recipe import producer against a real Valkey: one import per URL while
 * it is in flight, scoped by the view policy, and a new import once the first
 * has finished, whatever the job history keeps.
 */
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { ValkeyContainer } from "@testcontainers/valkey";
import { Queue, Worker } from "bullmq";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { PermissionLevel } from "@norish/config/zod/server-config";
import type { RecipeImportJobData } from "@norish/queue/contracts/job-types";

import { VALKEY_IMAGE, valkeyUrl } from "../../../shared-server/__tests__/helpers/valkey";
import { QUEUE_NAMES } from "../../src/queue-names";
import { addImportJob } from "../../src/recipe-import/producer";
import { getBullConnectionOptions } from "../../src/valkey/bullmq";

const policy = vi.hoisted(() => ({ view: "everyone" as PermissionLevel }));
const db = vi.hoisted(() => ({
  recipeExistsByUrlForPolicy: vi.fn(async () => ({ exists: false as boolean })),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: async () => ({
    view: policy.view,
    edit: "household",
    delete: "household",
  }),
}));
vi.mock("@norish/db", () => db);

let container: StartedValkeyContainer;
let queue: Queue<RecipeImportJobData>;

beforeAll(async () => {
  container = await new ValkeyContainer(VALKEY_IMAGE).start();
  queue = new Queue(QUEUE_NAMES.RECIPE_IMPORT, {
    connection: getBullConnectionOptions(valkeyUrl(container)),
  });
});

afterEach(async () => {
  policy.view = "everyone";
  await queue.obliterate({ force: true });
});

afterAll(async () => {
  await queue?.close();
  await container?.stop();
});

function importData(overrides: Partial<RecipeImportJobData> = {}): RecipeImportJobData {
  return {
    url: "https://example.com/recipe",
    recipeId: "recipe-1",
    userId: "user-1",
    householdKey: "household-1",
    householdUserIds: ["user-1"],
    ...overrides,
  };
}

it("imports the same URL once while the first import is in flight", async () => {
  const first = await addImportJob(queue, importData());
  const second = await addImportJob(queue, importData({ recipeId: "recipe-2" }));

  expect(first.status).toBe("queued");
  expect(second).toEqual({ status: "duplicate", existingJobId: "recipe-1" });
  expect(await queue.getJobCounts("waiting")).toEqual({ waiting: 1 });
});

it("imports the URL again once the first import has finished, though its job is kept", async () => {
  await addImportJob(queue, importData());

  const worker = new Worker(QUEUE_NAMES.RECIPE_IMPORT, async () => {}, {
    connection: getBullConnectionOptions(valkeyUrl(container)),
  });

  await expect.poll(() => queue.getCompletedCount()).toBe(1);
  await worker.close();

  const again = await addImportJob(queue, importData({ recipeId: "recipe-2" }));

  expect(again.status).toBe("queued");
  expect(await queue.getJobCounts("waiting", "completed")).toEqual({ waiting: 1, completed: 1 });
});

it("answers with the recipe a URL already imported, and queues nothing", async () => {
  db.recipeExistsByUrlForPolicy.mockResolvedValueOnce({
    exists: true,
    existingRecipeId: "kept",
  } as never);

  await expect(addImportJob(queue, importData())).resolves.toEqual({
    status: "exists",
    existingRecipeId: "kept",
  });
  expect(await queue.getJobCounts("waiting")).toEqual({ waiting: 0 });
});

describe("the view policy scopes what counts as the same import", () => {
  it("everyone: one import per URL, whoever asks", async () => {
    await addImportJob(queue, importData());
    const other = await addImportJob(
      queue,
      importData({ recipeId: "recipe-2", userId: "user-2", householdKey: "household-2" })
    );

    expect(other.status).toBe("duplicate");
  });

  it("household: one per household", async () => {
    policy.view = "household";

    await addImportJob(queue, importData());
    const sameHousehold = await addImportJob(
      queue,
      importData({ recipeId: "recipe-2", userId: "user-2" })
    );
    const otherHousehold = await addImportJob(
      queue,
      importData({ recipeId: "recipe-3", userId: "user-3", householdKey: "household-3" })
    );

    expect(sameHousehold.status).toBe("duplicate");
    expect(otherHousehold.status).toBe("queued");
  });

  it("owner: one per user", async () => {
    policy.view = "owner";

    await addImportJob(queue, importData());
    const sameUser = await addImportJob(queue, importData({ recipeId: "recipe-2" }));
    const otherUser = await addImportJob(
      queue,
      importData({ recipeId: "recipe-3", userId: "user-2" })
    );

    expect(sameUser.status).toBe("duplicate");
    expect(otherUser.status).toBe("queued");
  });
});
