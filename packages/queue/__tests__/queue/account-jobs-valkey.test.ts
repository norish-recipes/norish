// @vitest-environment node
/**
 * The jobs of a deleted account against a real Valkey: none is kept, waiting or retained, and one
 * running as the account goes ends quietly and is then removed, payload and all.
 */
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { Queue } from "bullmq";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

import type { QueueName } from "../../src/queue-names";
import { startValkey, valkeyUrl } from "../../../shared-server/__tests__/helpers/valkey";
import { ACCOUNT_QUEUES, AccountGoneError } from "../../src/account-jobs";
import { closeWorkers, createWorker } from "../../src/create-worker";
import { QUEUE_NAMES } from "../../src/queue-names";
import { removeAccountJobs } from "../../src/remove-account-jobs";
import { closeBullConnection, getBullClient } from "../../src/valkey/bullmq";

const config = vi.hoisted(() => ({ url: "" }));
const gone = vi.hoisted(() => new Set<string>());
const queues = vi.hoisted(() => new Map<string, Queue>());

vi.mock("@norish/db/repositories/households", () => ({
  getHouseholdIdForUser: async (userId: string) => (gone.has(userId) ? null : "household-1"),
}));
vi.mock("@norish/queue/registry", () => ({
  getQueueByName: (name: QueueName) => queues.get(name),
}));
vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    get VALKEY_URL() {
      return config.url;
    },
  },
}));

const IMAGES = QUEUE_NAMES.IMAGE_IMPORT;
const photos = (userId: string, recipeId = crypto.randomUUID()) => ({
  recipeId,
  userId,
  householdId: "household-1",
  files: [{ data: "base64-photo", mimeType: "image/jpeg", filename: "soep.jpg" }],
});

let container: StartedValkeyContainer;

beforeAll(async () => {
  container = await startValkey();
  config.url = valkeyUrl(container);
});

beforeEach(() => {
  gone.clear();
  for (const name of ACCOUNT_QUEUES) {
    queues.set(name, new Queue(name, { connection: getBullClient() }));
  }
});

afterEach(async () => {
  await closeWorkers(0);
  for (const queue of queues.values()) {
    await queue.obliterate({ force: true });
    await queue.close();
  }
  queues.clear();
});

afterAll(async () => {
  await closeBullConnection();
  await container?.stop();
});

it("removes a deleted account's waiting, delayed and retained jobs, and its recipes'", async () => {
  const images = queues.get(IMAGES)!;
  const tagging = queues.get(QUEUE_NAMES.AUTO_TAGGING)!;

  const pasted = queues.get(QUEUE_NAMES.PASTE_IMPORT)!;

  // One completed and one failed, retained as the queues' retention keeps them.
  createWorker(QUEUE_NAMES.PASTE_IMPORT, async (job) => {
    if (job.data.text === "fails") throw new Error("Not a recipe");
  });
  const pastedJob = (text: string) => ({
    batchId: "batch",
    recipeIds: [crypto.randomUUID()],
    userId: "deleted",
    householdId: "household-1",
    text,
  });
  const completed = await pasted.add("paste", pastedJob("Soep"));
  const failed = await pasted.add("paste", pastedJob("fails"));

  await expect.poll(() => pasted.getJobState(completed.id!)).toBe("completed");
  await expect.poll(() => pasted.getJobState(failed.id!)).toBe("failed");

  const waiting = await images.add("import", photos("deleted"));
  const delayed = await images.add("import", photos("deleted"), { delay: 60_000 });
  const others = await images.add("import", photos("stays"));
  const ofErasedRecipe = await tagging.add("tag", { recipeId: "erased", userId: "stays" });
  const ofKeptRecipe = await tagging.add("tag", { recipeId: "kept", userId: "stays" });

  await removeAccountJobs("deleted", ["erased"]);

  for (const job of [waiting, delayed, completed, failed, ofErasedRecipe]) {
    expect(await job.queue.getJob(job.id!)).toBeUndefined();
  }
  expect(await images.getJob(others.id!)).toBeDefined();
  expect(await tagging.getJob(ofKeptRecipe.id!)).toBeDefined();
});

it("ends a job running as its account goes quietly, and keeps none of it", async () => {
  const images = queues.get(IMAGES)!;
  let release = () => {};
  const running = new Promise<void>((resolve) => (release = resolve));
  let failure: unknown;

  createWorker(
    IMAGES,
    async () => {
      await running;
      // The save fails on the account's missing row.
      throw new Error("insert or update violates foreign key constraint");
    },
    { onFailed: (_job, error) => void (failure = error) }
  );
  const job = await images.add("import", photos("deleted"));

  await expect.poll(() => images.getJobState(job.id!)).toBe("active");
  gone.add("deleted");
  await removeAccountJobs("deleted", []);
  release();

  await expect.poll(() => images.getJob(job.id!)).toBeUndefined();
  expect(failure).toBeInstanceOf(AccountGoneError);
});

it("runs nothing of a job whose account went before it started, and keeps none of it", async () => {
  const images = queues.get(IMAGES)!;
  const processor = vi.fn();

  gone.add("deleted");
  createWorker(IMAGES, processor);
  const job = await images.add("import", photos("deleted"));

  await expect.poll(() => images.getJob(job.id!)).toBeUndefined();
  expect(processor).not.toHaveBeenCalled();
});
