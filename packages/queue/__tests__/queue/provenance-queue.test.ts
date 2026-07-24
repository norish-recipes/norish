// @vitest-environment node

import type { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProvenanceJobData } from "@norish/queue/contracts/job-types";

const mockAdd = vi.fn();
const mockGetJob = vi.fn();
const mockClose = vi.fn();
const mockCreateLazyWorker = vi.fn();
const mockStopLazyWorker = vi.fn();
const mockInferProvenance = vi.fn();

class MockUnrecoverableError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "UnrecoverableError";
  }
}

vi.mock("bullmq", () => ({
  Queue: class MockQueue {
    add = mockAdd;
    getJob = mockGetJob;
    close = mockClose;
  },
  Job: class MockJob {},
  UnrecoverableError: MockUnrecoverableError,
}));

vi.mock("@norish/queue/lazy-worker-manager", () => ({
  createLazyWorker: mockCreateLazyWorker,
  stopLazyWorker: mockStopLazyWorker,
}));

vi.mock("@norish/queue/config", () => ({
  provenanceJobOptions: { attempts: 3 },
  QUEUE_NAMES: { PROVENANCE: "recipe-provenance" },
  baseWorkerOptions: {},
  STALLED_INTERVAL: { "recipe-provenance": 60_000 },
  WORKER_CONCURRENCY: { "recipe-provenance": 2 },
}));

vi.mock("@norish/queue/redis/bullmq", () => ({
  getBullClient: vi.fn(() => ({ duplicate: vi.fn() })),
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock("@norish/queue/helpers", () => ({ isJobInQueue: vi.fn() }));

vi.mock("@norish/queue/job-steps", () => ({ reportStep: vi.fn() }));

vi.mock("@norish/db", () => ({
  getRecipeFull: vi.fn(),
  updateRecipeProvenance: vi.fn(),
}));

vi.mock("@norish/queue/api-handlers", () => ({
  requireQueueApiHandler: vi.fn(
    (name: string) => ({ inferRecipeProvenance: mockInferProvenance })[name]
  ),
}));

vi.mock("@norish/shared-server/realtime/recipes", () => ({
  recipeEmitter: { emitToHousehold: vi.fn(), emitToUser: vi.fn(), broadcast: vi.fn() },
}));

vi.mock("@norish/shared-server/realtime/policy", () => ({ emitByPolicy: vi.fn() }));

vi.mock("@norish/shared-server/config/server-config-loader", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@norish/shared-server/config/server-config-loader")>();

  return { ...actual, isAIEnabled: vi.fn(), getRecipePermissionPolicy: vi.fn() };
});

const RECIPE = {
  id: "recipe-123",
  name: "Lasagne",
  description: "Baked pasta",
  recipeIngredients: [{ ingredientName: "pasta" }, { ingredientName: "tomato" }],
};

const JOB_DATA: ProvenanceJobData = {
  recipeId: "recipe-123",
  userId: "user-456",
  householdKey: "household-789",
};

describe("Provenance Queue", () => {
  let mockQueue: Queue<ProvenanceJobData>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLazyWorker.mockResolvedValue(undefined);
    mockQueue = { add: mockAdd, getJob: mockGetJob, close: mockClose } as unknown as Queue<
      ProvenanceJobData
    >;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("addProvenanceJob", () => {
    it("skips when AI is disabled", async () => {
      const { isAIEnabled } = await import("@norish/shared-server/config/server-config-loader");

      vi.mocked(isAIEnabled).mockResolvedValue(false);

      const { addProvenanceJob } = await import("@norish/queue/provenance/producer");
      const result = await addProvenanceJob(mockQueue, JOB_DATA);

      expect(result.status).toBe("skipped");
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it("enqueues a deterministic job when AI is enabled and none is in flight", async () => {
      const { isAIEnabled } = await import("@norish/shared-server/config/server-config-loader");
      const { isJobInQueue } = await import("@norish/queue/helpers");

      vi.mocked(isAIEnabled).mockResolvedValue(true);
      vi.mocked(isJobInQueue).mockResolvedValue(false);
      mockAdd.mockResolvedValue({ id: "provenance-recipe-123" });

      const { addProvenanceJob } = await import("@norish/queue/provenance/producer");
      const result = await addProvenanceJob(mockQueue, JOB_DATA);

      expect(result.status).toBe("queued");
      expect(mockAdd).toHaveBeenCalledWith(
        "infer-provenance",
        JOB_DATA,
        expect.objectContaining({ jobId: "provenance-recipe-123" })
      );
    });

    it("rejects a duplicate when a job is already in flight", async () => {
      const { isAIEnabled } = await import("@norish/shared-server/config/server-config-loader");
      const { isJobInQueue } = await import("@norish/queue/helpers");

      vi.mocked(isAIEnabled).mockResolvedValue(true);
      vi.mocked(isJobInQueue).mockResolvedValue(true);

      const { addProvenanceJob } = await import("@norish/queue/provenance/producer");
      const result = await addProvenanceJob(mockQueue, JOB_DATA);

      expect(result.status).toBe("duplicate");
      expect(mockAdd).not.toHaveBeenCalled();
    });
  });

  describe("processProvenanceJob", () => {
    async function getProcessor() {
      const { startProvenanceWorker } = await import("@norish/queue/provenance/worker");

      await startProvenanceWorker();

      return {
        processor: mockCreateLazyWorker.mock.calls[0]?.[1] as (job: unknown) => Promise<void>,
        onFailed: mockCreateLazyWorker.mock.calls[0]?.[3] as (
          job: unknown,
          error: Error
        ) => Promise<void>,
      };
    }

    const job = { id: "job-1", data: JOB_DATA, attemptsMade: 0, opts: { attempts: 3 } };

    beforeEach(async () => {
      const { getRecipePermissionPolicy } =
        await import("@norish/shared-server/config/server-config-loader");

      vi.mocked(getRecipePermissionPolicy).mockResolvedValue({
        view: "household",
        edit: "household",
        delete: "household",
      });
    });

    it("infers, saves atomically, and emits updated + succeeded", async () => {
      const { getRecipeFull, updateRecipeProvenance } = await import("@norish/db");
      const { emitByPolicy } = await import("@norish/shared-server/realtime/policy");

      const provenance = {
        originCountryCode: "IT",
        region: "Emilia-Romagna",
        cuisines: ["Italian"],
        note: "A classic baked pasta.",
      };

      vi.mocked(getRecipeFull).mockResolvedValue({ ...RECIPE, ...provenance } as never);
      mockInferProvenance.mockResolvedValue({ success: true, data: provenance });

      const { processor } = await getProcessor();

      await processor(job);

      expect(updateRecipeProvenance).toHaveBeenCalledWith("recipe-123", provenance);

      const events = vi.mocked(emitByPolicy).mock.calls.map((c) => c[3]);

      expect(events).toContain("updated");
      const provenanceEvents = vi
        .mocked(emitByPolicy)
        .mock.calls.filter((c) => c[3] === "provenance")
        .map((c) => c[4]);

      expect(provenanceEvents).toContainEqual({ recipeId: "recipe-123", status: "processing" });
      expect(provenanceEvents).toContainEqual({ recipeId: "recipe-123", status: "succeeded" });
    });

    it("does not retry or write when the recipe is missing", async () => {
      const { getRecipeFull, updateRecipeProvenance } = await import("@norish/db");

      vi.mocked(getRecipeFull).mockResolvedValue(null);

      const { processor } = await getProcessor();

      await expect(processor(job)).rejects.toMatchObject({ name: "UnrecoverableError" });
      expect(mockInferProvenance).not.toHaveBeenCalled();
      expect(updateRecipeProvenance).not.toHaveBeenCalled();
    });

    it("does not write on a permanent AI failure and stops retrying", async () => {
      const { getRecipeFull, updateRecipeProvenance } = await import("@norish/db");

      vi.mocked(getRecipeFull).mockResolvedValue(RECIPE as never);
      mockInferProvenance.mockResolvedValue({
        success: false,
        error: "bad output",
        code: "VALIDATION_ERROR",
      });

      const { processor } = await getProcessor();

      await expect(processor(job)).rejects.toMatchObject({ name: "UnrecoverableError" });
      expect(updateRecipeProvenance).not.toHaveBeenCalled();
    });

    it("throws a retryable error (not Unrecoverable) on a transient AI failure", async () => {
      const { getRecipeFull, updateRecipeProvenance } = await import("@norish/db");

      vi.mocked(getRecipeFull).mockResolvedValue(RECIPE as never);
      mockInferProvenance.mockResolvedValue({
        success: false,
        error: "provider down",
        code: "PROVIDER_ERROR",
      });

      const { processor } = await getProcessor();

      const error = await processor(job).then(
        () => null,
        (e: Error) => e
      );

      expect(error).toBeInstanceOf(Error);
      expect(error?.name).not.toBe("UnrecoverableError");
      expect(updateRecipeProvenance).not.toHaveBeenCalled();
    });

    it("emits a terminal failed event on final failure", async () => {
      const { emitByPolicy } = await import("@norish/shared-server/realtime/policy");
      const { onFailed } = await getProcessor();

      await onFailed(
        { ...job, attemptsMade: 3 },
        Object.assign(new Error("boom"), { name: "Error" })
      );

      const provenanceEvents = vi
        .mocked(emitByPolicy)
        .mock.calls.filter((c) => c[3] === "provenance")
        .map((c) => c[4]);

      expect(provenanceEvents).toContainEqual({ recipeId: "recipe-123", status: "failed" });
    });
  });
});
