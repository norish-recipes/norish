// @vitest-environment node
/**
 * An omitted key keeps the stored one and an empty key removes it, so a block with
 * nothing of its own falls back to the AI key, as its field promises.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SetConfigOptions } from "@norish/db/repositories/server-config";
import { aiConfigProcedures } from "@norish/trpc/routers/admin/ai-config";

import { getConfig, resetServerConfigMocks, setConfig } from "../mocks/server-config";
import { isUserServerAdmin } from "../mocks/users";
import { createMockAdminContext, createMockAdminUser } from "./test-utils";

vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));
vi.mock("@norish/db/repositories/server-config", () => import("../mocks/server-config"));
vi.mock("@norish/shared-server/ai/prompts/loader", () => ({ getEffectivePrompts: vi.fn() }));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const VIDEO = {
  enabled: true,
  maxLengthSeconds: 120,
  maxVideoFileSize: 100 * 1024 * 1024,
  transcriptionProvider: "openai" as const,
  transcriptionModel: "whisper-1",
};
const IMAGE = { provider: "openai" as const, model: "gpt-image-1" };

const caller = () =>
  aiConfigProcedures.createCaller(createMockAdminContext(createMockAdminUser()) as never);
const dropped = () =>
  ((setConfig.mock.calls[0] as unknown[])[4] as SetConfigOptions | undefined)?.dropSecrets;

beforeEach(() => {
  resetServerConfigMocks();
  isUserServerAdmin.mockResolvedValue(true);
});

describe("updateVideoConfig", () => {
  beforeEach(() => getConfig.mockResolvedValue(VIDEO));

  it("removes the stored transcription key when the save sends an empty one", async () => {
    await caller().updateVideoConfig({ ...VIDEO, transcriptionApiKey: "" });

    expect(dropped()).toContain("transcriptionApiKey");
  });

  it.each([undefined, "new-key"])("keeps or replaces it for %s", async (transcriptionApiKey) => {
    await caller().updateVideoConfig({ ...VIDEO, transcriptionApiKey });

    expect(dropped()).not.toContain("transcriptionApiKey");
  });
});

describe("updateImageGenerationConfig", () => {
  beforeEach(() => getConfig.mockResolvedValue(IMAGE));

  it("removes the stored key when the save sends an empty one", async () => {
    await caller().updateImageGenerationConfig({ ...IMAGE, apiKey: "" });

    expect(dropped()).toContain("apiKey");
  });

  it("keeps it when the save omits it", async () => {
    await caller().updateImageGenerationConfig(IMAGE);

    expect(dropped()).not.toContain("apiKey");
  });
});
