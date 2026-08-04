// @vitest-environment node
/**
 * The video-import dispatch gate.
 *
 * A video recipe can only be extracted with AI, and the video pipeline
 * downloads (and may pay for a transcription) before extraction runs. The
 * import endpoint therefore refuses a video URL before anything is enqueued
 * when AI or video parsing is off — the caller gets an immediate, precise
 * answer instead of a queued job that can only fail.
 */
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recipesRouter } from "../../src/routers/recipes";
import { isVideoParsingEnabled } from "../mocks/config";
import { isAIEnabled } from "../mocks/permissions";
import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

const mocked = vi.hoisted(() => ({
  addImportJob: vi.fn(),
}));

vi.mock("@norish/queue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/queue")>();

  return { ...actual, addImportJob: mocked.addImportJob };
});

vi.mock("@norish/queue/registry", () => ({
  getQueues: vi.fn(() => ({ recipeImport: {} })),
}));

vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/trpc/routers/recipes/emitter", () => import("../mocks/recipe-emitter"));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("../mocks/config"));

const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

const mockUser = createMockUser();
const mockHousehold = createMockHousehold();
let ctx: ReturnType<typeof createMockAuthedContext>;

function caller() {
  return t.createCallerFactory(recipesRouter)(ctx);
}

const VIDEO_URL = "https://www.youtube.com/watch?v=abc123";
const PAGE_URL = "https://example.com/recipe";

beforeEach(() => {
  vi.clearAllMocks();
  ctx = createMockAuthedContext(mockUser, mockHousehold);
  isAIEnabled.mockResolvedValue(true);
  isVideoParsingEnabled.mockResolvedValue(true);
  mocked.addImportJob.mockResolvedValue({ status: "queued", job: { id: "job-1" } });
});

describe("importFromUrl video gate", () => {
  it("refuses a video URL before dispatching when AI is disabled, naming AI", async () => {
    isAIEnabled.mockResolvedValue(false);

    await expect(caller().importFromUrl({ url: VIDEO_URL })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("AI features are not enabled"),
    });
    expect(mocked.addImportJob).not.toHaveBeenCalled();
  });

  it("refuses a video URL naming video parsing when AI is on but video parsing is off", async () => {
    isVideoParsingEnabled.mockResolvedValue(false);

    await expect(caller().importFromUrl({ url: VIDEO_URL })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Video recipe parsing is not enabled"),
    });
    expect(mocked.addImportJob).not.toHaveBeenCalled();
  });

  it("dispatches a video URL when AI and video parsing are both enabled", async () => {
    const result = await caller().importFromUrl({ url: VIDEO_URL });

    expect(result.status).toBe("queued");
    expect(mocked.addImportJob).toHaveBeenCalledTimes(1);
  });

  it("still dispatches a non-video URL with AI disabled, because structured parsing needs no AI", async () => {
    isAIEnabled.mockResolvedValue(false);

    const result = await caller().importFromUrl({ url: PAGE_URL });

    expect(result.status).toBe("queued");
    expect(mocked.addImportJob).toHaveBeenCalledTimes(1);
  });
});
