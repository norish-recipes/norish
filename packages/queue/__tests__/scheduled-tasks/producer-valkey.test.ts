// @vitest-environment node
/**
 * The scheduled tasks against a real Valkey: every boot leaves exactly one Job
 * Scheduler per task, at midnight, carrying the task it runs. A boot runs the
 * registration again on every restart, so it must not pile schedules up, nor
 * catalogue asks.
 */
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { ValkeyContainer } from "@testcontainers/valkey";
import { Queue, Worker } from "bullmq";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { ScheduledTaskJobData } from "../../src/scheduled-tasks/tasks";
import { VALKEY_IMAGE, valkeyUrl } from "../../../shared-server/__tests__/helpers/valkey";
import { initializeScheduledJobs } from "../../src/scheduled-tasks/producer";
import { SCHEDULED_TASKS } from "../../src/scheduled-tasks/tasks";
import { getBullConnectionOptions } from "../../src/valkey/bullmq";

let valkey: StartedValkeyContainer;
let queue: Queue<ScheduledTaskJobData>;

beforeAll(async () => {
  valkey = await new ValkeyContainer(VALKEY_IMAGE).start();
  queue = new Queue("scheduled-tasks", {
    connection: getBullConnectionOptions(valkeyUrl(valkey)),
  });
});

afterAll(async () => {
  await queue?.close();
  await valkey?.stop();
});

it("registers one scheduler per task at midnight, and a second boot adds none", async () => {
  await initializeScheduledJobs(queue);
  await initializeScheduledJobs(queue);

  const schedulers = await queue.getJobSchedulers();

  expect(schedulers.map((scheduler) => scheduler.key).sort()).toEqual([...SCHEDULED_TASKS].sort());
  for (const scheduler of schedulers) {
    expect(scheduler.pattern).toBe("0 0 * * *");
    expect(scheduler.template?.data).toEqual({ taskType: scheduler.key });
  }

  // Each scheduler holds its next run, once.
  const delayed = await queue.getJobs(["delayed"]);

  expect(delayed.map((job) => job.data.taskType).sort()).toEqual([...SCHEDULED_TASKS].sort());
});

it("asks for the catalogue once however often it boots, and again once that ask has run", async () => {
  const connection = getBullConnectionOptions(valkeyUrl(valkey));
  const booting = new Queue<ScheduledTaskJobData>("scheduled-tasks-boot", { connection });
  const asks = async () =>
    (await booting.getJobs(["waiting", "completed"])).filter(
      (job) => job.data.taskType === "ingredient-catalogue-refresh" && !job.repeatJobKey
    );

  try {
    await initializeScheduledJobs(booting);
    await initializeScheduledJobs(booting);
    expect(await asks()).toHaveLength(1);

    const worker = new Worker("scheduled-tasks-boot", async () => {}, { connection });

    await expect.poll(async () => (await booting.getCompletedCount()) > 0).toBe(true);
    await worker.close();

    await initializeScheduledJobs(booting);
    expect(await asks()).toHaveLength(2);
  } finally {
    await booting.obliterate({ force: true });
    await booting.close();
  }
});
