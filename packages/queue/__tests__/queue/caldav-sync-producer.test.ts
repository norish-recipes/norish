// @vitest-environment node
/**
 * The CalDAV sync producer against a real Valkey, with an always-on worker
 * recording what it syncs: a burst of edits to one planned item is one sync,
 * an edit during a running sync is synced right after it, and no edit is lost.
 */
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import type { Job } from "bullmq";
import { ValkeyContainer } from "@testcontainers/valkey";
import { Queue } from "bullmq";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";

import type { CaldavSyncJobData } from "@norish/queue/contracts/job-types";

import { VALKEY_IMAGE, valkeyUrl } from "../../../shared-server/__tests__/helpers/valkey";
import { addCaldavSyncJob, isCaldavSyncPending } from "../../src/caldav-sync/producer";
import { closeWorkers, createWorker } from "../../src/create-worker";
import { QUEUE_NAMES } from "../../src/queue-names";
import { closeBullConnection, getBullClient } from "../../src/valkey/bullmq";

const config = vi.hoisted(() => ({ url: "" }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    get VALKEY_URL() {
      return config.url;
    },
  },
}));

let container: StartedValkeyContainer;
let queue: Queue<CaldavSyncJobData>;
/** What the worker synced, in order: item and title. */
let synced: string[] = [];
/** A sync the worker holds until the test calls `release()`. */
let hold: { itemId: string; started: () => void; released: Promise<void> } | null = null;
let release = () => {};

beforeAll(async () => {
  container = await new ValkeyContainer(VALKEY_IMAGE).start();
  config.url = valkeyUrl(container);
  queue = new Queue(QUEUE_NAMES.CALDAV_SYNC, { connection: getBullClient() });
});

afterEach(async () => {
  release();
  hold = null;
  synced = [];
  await closeWorkers(0);
  await queue.obliterate({ force: true });
});

afterAll(async () => {
  await queue?.close();
  await closeBullConnection();
  await container?.stop();
});

function startWorker() {
  createWorker(QUEUE_NAMES.CALDAV_SYNC, async (job: Job<CaldavSyncJobData>) => {
    if (hold?.itemId === job.data.itemId) {
      const { started, released } = hold;

      hold = null;
      started();
      await released;
    }
    synced.push(`${job.data.itemId}:${job.data.eventTitle}`);
  });
}

/** Resolves once the next sync of this item has started; it then waits for `release()`. */
function holdNextSyncOf(itemId: string): Promise<void> {
  const released = new Promise<void>((resolve) => (release = resolve));

  return new Promise<void>((started) => (hold = { itemId, started, released }));
}

function sync(itemId: string, eventTitle: string): CaldavSyncJobData {
  return {
    userId: "user-1",
    itemId,
    itemType: "recipe",
    plannedItemId: itemId,
    eventTitle,
    date: "2026-10-14",
    slot: "Dinner",
    operation: "sync",
    caldavServerUrl: "https://radicale.example/dav/",
  };
}

async function settled() {
  await expect
    .poll(
      async () =>
        Object.values(await queue.getJobCounts("delayed", "waiting", "active")).reduce(
          (sum, count) => sum + count,
          0
        ),
      { timeout: 15_000 }
    )
    .toBe(0);
}

it("syncs a burst of edits within the delay once, with the last state", async () => {
  startWorker();

  for (const title of ["one", "two", "three", "four", "five"]) {
    await addCaldavSyncJob(queue, sync("lasagne", title));
  }

  await settled();
  expect(synced).toEqual(["lasagne:five"]);
}, 30_000);

it("syncs an edit made during a running sync right after it, once", async () => {
  startWorker();
  const running = holdNextSyncOf("lasagne");

  await addCaldavSyncJob(queue, sync("lasagne", "first"));
  await running;

  await addCaldavSyncJob(queue, sync("lasagne", "second"));
  await addCaldavSyncJob(queue, sync("lasagne", "third"));
  release();

  await expect.poll(() => synced, { timeout: 15_000 }).toHaveLength(2);
  await settled();
  expect(synced).toEqual(["lasagne:first", "lasagne:third"]);
}, 30_000);

it("syncs the newer state of a job already waiting behind another item's sync", async () => {
  startWorker();
  const running = holdNextSyncOf("soup");

  await addCaldavSyncJob(queue, sync("soup", "soup"));
  await addCaldavSyncJob(queue, sync("lasagne", "moved once"));
  await running;
  // The lasagne's sync has to wait for the worker, past the point BullMQ
  // replaces it. Added a moment after the soup's, it can still be short of its
  // delay when the worker takes the soup, so it is promoted rather than timed.
  await queue.promoteJobs();
  expect(await queue.getWaitingCount()).toBe(1);

  await addCaldavSyncJob(queue, sync("lasagne", "moved twice"));
  release();

  await settled();
  expect(synced).toEqual(["soup:soup", "lasagne:moved twice"]);
}, 30_000);

it("keeps the newer state when the worker takes the waiting job before it is handed over", async () => {
  startWorker();
  const soupRunning = holdNextSyncOf("soup");

  await addCaldavSyncJob(queue, sync("soup", "soup"));
  await addCaldavSyncJob(queue, sync("lasagne", "moved once"));
  await soupRunning;
  await queue.promoteJobs();
  expect(await queue.getWaitingCount()).toBe(1);

  // The race: between the add and the hand-over, the worker takes the
  // waiting lasagne job, with the older state.
  const releaseSoup = release;
  const lasagneRunning = holdNextSyncOf("lasagne");
  const getJob = queue.getJob.bind(queue);

  vi.spyOn(queue, "getJob").mockImplementationOnce(async (id) => {
    releaseSoup();
    await lasagneRunning;

    return getJob(id);
  });

  await addCaldavSyncJob(queue, sync("lasagne", "moved twice"));
  release();

  await settled();
  expect(synced).toEqual(["soup:soup", "lasagne:moved once", "lasagne:moved twice"]);
}, 30_000);

it("counts an item's sync as pending while delayed or running, and not once it has run", async () => {
  const pending = () => isCaldavSyncPending(queue, "https://radicale.example/dav/", "lasagne");

  await addCaldavSyncJob(queue, sync("lasagne", "created"));
  expect(await pending()).toBe(true);

  startWorker();
  const running = holdNextSyncOf("lasagne");

  await queue.promoteJobs();
  await running;
  expect(await pending()).toBe(true);

  release();
  await settled();
  expect(await pending()).toBe(false);
}, 30_000);
