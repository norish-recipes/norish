// @vitest-environment node

import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recipesRouter } from "../../src/routers/recipes";
import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

const mocks = vi.hoisted(() => ({
  addImageImportJob: vi.fn(),
  getUserPreferences: vi.fn(),
}));

vi.mock("@norish/queue", () => ({
  addImageImportJob: mocks.addImageImportJob,
}));

vi.mock("@norish/queue/registry", () => ({
  getQueues: vi.fn(() => ({ imageImport: {} })),
}));

vi.mock("@norish/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/db")>();

  return { ...actual, getUserPreferences: mocks.getUserPreferences };
});

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(),
  }),
  trpcLogger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

const ctx = createMockAuthedContext(createMockUser(), createMockHousehold());

function caller() {
  return recipesRouter.createCaller({ ...ctx, connectionId: null, operationId: null });
}

function formData(autoEnrich?: string): FormData {
  const data = new FormData();

  data.append("file0", new File(["image"], "photo.jpg", { type: "image/jpeg" }));

  if (autoEnrich !== undefined) data.append("autoEnrich", autoEnrich);

  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.addImageImportJob.mockResolvedValue({ status: "queued", job: { id: "job-1" } });
  mocks.getUserPreferences.mockResolvedValue({});
});

describe("importFromImages auto-enrich", () => {
  it("passes an explicit off choice on the image job", async () => {
    await caller().importFromImages(formData("false"));

    expect(mocks.addImageImportJob).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ autoEnrich: false })
    );
  });

  it("passes an explicit on choice on the image job", async () => {
    await caller().importFromImages(formData("true"));

    expect(mocks.addImageImportJob).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ autoEnrich: true })
    );
  });

  it("reads the stored setting when the form gives no choice", async () => {
    mocks.getUserPreferences.mockResolvedValue({ autoEnrichOnAdd: false });

    await caller().importFromImages(formData());

    expect(mocks.addImageImportJob).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ autoEnrich: false })
    );
  });

  it("defaults to on when the stored setting is absent", async () => {
    await caller().importFromImages(formData());

    expect(mocks.addImageImportJob).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ autoEnrich: true })
    );
  });
});
