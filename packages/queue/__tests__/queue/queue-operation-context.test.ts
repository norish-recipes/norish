import { describe, expect, it, vi } from "vitest";

import { runWithOperationContext } from "@norish/shared-server/lib/operation-context";
import { generateOperationId } from "@norish/shared/lib/operation-helpers";

import { createOperationAwareQueue } from "../../src/operation-aware-queue";
import {
  createContextAwareProcessor,
  extractJobOperationId,
  withJobOperationContext,
} from "../../src/queue-operation-context";

vi.mock("bullmq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bullmq")>();

  class MockQueue<
    DataTypeOrJob = any,
    DefaultResultType = any,
    DefaultNameType extends string = string,
  > {
    add = vi.fn(async (name: DefaultNameType, data: DataTypeOrJob, opts?: unknown) => ({
      id: "job-1",
      name,
      data,
      opts,
    }));

    addBulk = vi.fn(async (jobs: unknown[]) => jobs);

    close = vi.fn(async () => undefined);
  }

  return {
    ...actual,
    Queue: MockQueue,
  };
});

describe("withJobOperationContext", () => {
  it("attaches the current operationId to job data", () => {
    const opId = generateOperationId();

    const result = runWithOperationContext({ operationId: opId }, () =>
      withJobOperationContext({ recipeId: "r-1", userId: "u-1" })
    );

    expect(result.__operationId).toBe(opId);
    expect(result.recipeId).toBe("r-1");
    expect(result.userId).toBe("u-1");
  });

  it("returns data unchanged when no operation context is active", () => {
    const data = { recipeId: "r-1", userId: "u-1" };
    const result = withJobOperationContext(data);

    expect(result.__operationId).toBeUndefined();
    expect(result.recipeId).toBe("r-1");
  });
});

describe("createOperationAwareQueue", () => {
  it("injects operationId when queue.add runs inside operation context", async () => {
    const opId = generateOperationId();
    const queue = createOperationAwareQueue<{ recipeId: string; userId: string }>("test-queue");

    const job = await runWithOperationContext({ operationId: opId }, () =>
      queue.add("import", { recipeId: "r-1", userId: "u-1" })
    );

    expect(job.data).toEqual({
      recipeId: "r-1",
      userId: "u-1",
      __operationId: opId,
    });
  });

  it("injects operationId when queue.addBulk runs inside operation context", async () => {
    const opId = generateOperationId();
    const queue = createOperationAwareQueue<{ recipeId: string; userId: string }>("test-queue");

    const jobs = await runWithOperationContext({ operationId: opId }, () =>
      queue.addBulk([
        { name: "import", data: { recipeId: "r-1", userId: "u-1" } },
        { name: "import", data: { recipeId: "r-2", userId: "u-2" } },
      ])
    );

    expect(jobs).toEqual([
      {
        name: "import",
        data: { recipeId: "r-1", userId: "u-1", __operationId: opId },
        opts: undefined,
      },
      {
        name: "import",
        data: { recipeId: "r-2", userId: "u-2", __operationId: opId },
        opts: undefined,
      },
    ]);
  });
});

describe("extractJobOperationId", () => {
  it("extracts operationId from job data", () => {
    const opId = generateOperationId();
    const data = { __operationId: opId, recipeId: "r-1" };

    expect(extractJobOperationId(data)).toBe(opId);
  });

  it("returns undefined when no operationId is present", () => {
    expect(extractJobOperationId({ recipeId: "r-1" })).toBeUndefined();
  });

  it("returns undefined for nullish values", () => {
    expect(extractJobOperationId(null)).toBeUndefined();
    expect(extractJobOperationId(undefined)).toBeUndefined();
  });
});

describe("createContextAwareProcessor", () => {
  it("restores operation context before processing", async () => {
    const opId = generateOperationId();
    let capturedOpId: string | undefined;

    const processor = createContextAwareProcessor(async (job) => {
      const { getCurrentOperationId } = await import("@norish/shared-server/lib/operation-context");

      capturedOpId = getCurrentOperationId();

      return undefined as any;
    });

    const mockJob = {
      data: { __operationId: opId, recipeId: "r-1" },
    } as any;

    await processor(mockJob);

    expect(capturedOpId).toBe(opId);
  });

  it("processes without context when no operationId is in job data", async () => {
    let capturedOpId: string | undefined;

    const processor = createContextAwareProcessor(async (job) => {
      const { getCurrentOperationId } = await import("@norish/shared-server/lib/operation-context");

      capturedOpId = getCurrentOperationId();

      return undefined as any;
    });

    const mockJob = {
      data: { recipeId: "r-1" },
    } as any;

    await processor(mockJob);

    expect(capturedOpId).toBeUndefined();
  });
});
