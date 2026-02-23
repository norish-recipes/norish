/**
 * Allergy Detection Queue - Infrastructure
 *
 * Pure factory for creating queue instances.
 * Callers are responsible for lifecycle (close on shutdown).
 */

import type { AllergyDetectionJobData } from "@norish/queue/contracts/job-types";

import { Queue } from "bullmq";
import { getBullClient } from "@norish/queue/redis/bullmq";

import { allergyDetectionJobOptions, QUEUE_NAMES } from "../config";

/**
 * Create an allergy detection queue instance.
 * One queue instance per process is expected.
 */
export function createAllergyDetectionQueue(): Queue<AllergyDetectionJobData> {
  return new Queue<AllergyDetectionJobData>(QUEUE_NAMES.ALLERGY_DETECTION, {
    connection: getBullClient(),
    defaultJobOptions: allergyDetectionJobOptions,
  });
}
