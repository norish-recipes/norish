// @vitest-environment node
/**
 * The Page Renderers setting through the admin router: the CDP token is never read back in full,
 * a save keeps it only for the same endpoint, an empty one clears it, and only a server admin gets either.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PageRenderersConfig } from "@norish/config/zod/server-config";
import type { SetConfigOptions } from "@norish/db/repositories/server-config";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { pageRenderersProcedures } from "@norish/trpc/routers/admin/page-renderers";

import { getConfig, resetServerConfigMocks, setConfig } from "../mocks/server-config";
import { isUserServerAdmin } from "../mocks/users";
import { createMockAdminContext, createMockAdminUser, createMockUser } from "./test-utils";

vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));
vi.mock("@norish/db/repositories/server-config", () => import("../mocks/server-config"));
vi.mock("@norish/shared-server/ai/prompts/loader", () => ({ getEffectivePrompts: vi.fn() }));
const { testEndpoint } = vi.hoisted(() => ({ testEndpoint: vi.fn() }));

vi.mock("@norish/shared-server/page-renderers", () => ({ testPageRenderer: testEndpoint }));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const STORED: PageRenderersConfig = {
  obscura: { enabled: true, endpoint: "ws://obscura:9222", cdpToken: "the-real-token" },
  chromium: { enabled: true, endpoint: "http://chromium:9222" },
  solver: { enabled: false },
  allowPrivateAddresses: false,
  navigationTimeoutMs: 45000,
};

function createCaller(admin = true) {
  const ctx = createMockAdminContext(admin ? createMockAdminUser() : createMockUser());

  return pageRenderersProcedures.createCaller(ctx as never);
}

beforeEach(() => {
  resetServerConfigMocks();
  testEndpoint.mockClear();
  isUserServerAdmin.mockImplementation((userId: string) =>
    Promise.resolve(userId === createMockAdminUser().id)
  );
  // As the repository answers: the masked copy unless secrets are asked for.
  getConfig.mockImplementation(async (_key: string, includeSecrets?: boolean) =>
    includeSecrets ? STORED : { ...STORED, obscura: { ...STORED.obscura, cdpToken: "••••••••" } }
  );
});

describe("getPageRenderers", () => {
  it("reads the setting with the CDP token masked", async () => {
    const read = await createCaller().getPageRenderers();

    expect(read).toEqual({ ...STORED, obscura: { ...STORED.obscura, cdpToken: "••••••••" } });
    expect(JSON.stringify(read)).not.toContain("the-real-token");
  });

  it("refuses a non-admin", async () => {
    await expect(createCaller(false).getPageRenderers()).rejects.toThrow(
      /Server admin access required/i
    );
  });
});

/** Saves STORED with these Obscura fields; answers with the value handed on and the secrets dropped. */
async function save(obscura: Partial<PageRenderersConfig["obscura"]>) {
  const saved = { ...STORED, obscura: { ...STORED.obscura, ...obscura } };

  await expect(createCaller().updatePageRenderers(saved)).resolves.toEqual({ success: true });
  const [key, value, userId, isSensitive, options] = (setConfig.mock.calls[0] ?? []) as [
    unknown,
    PageRenderersConfig,
    unknown,
    unknown,
    SetConfigOptions | undefined,
  ];

  expect([key, value, userId, isSensitive]).toEqual([
    ServerConfigKeys.PAGE_RENDERERS,
    saved,
    createMockAdminUser().id,
    true,
  ]);

  return { value, dropped: options?.dropSecrets ?? [] };
}

describe("updatePageRenderers", () => {
  it("clears the stored token when the save sends an empty one", async () => {
    expect((await save({ cdpToken: "" })).dropped).toContain("cdpToken");
  });

  it.each(["••••••••", undefined])(
    "drops the stored token when the endpoint changes without a new one (%s)",
    async (cdpToken) => {
      const { dropped } = await save({ endpoint: "wss://elsewhere:9222", cdpToken });

      expect(dropped).toContain("cdpToken");
    }
  );

  it.each(["••••••••", undefined])(
    "keeps the stored token for the same endpoint (%s)",
    async (cdpToken) => {
      expect((await save({ cdpToken })).dropped).not.toContain("cdpToken");
    }
  );

  it("stores a new token entered with a changed endpoint", async () => {
    const { value } = await save({ endpoint: "wss://elsewhere:9222", cdpToken: "new-token" });

    expect(value.obscura.cdpToken).toBe("new-token");
  });

  it("saves the Chromium browser as sent, a query string in its endpoint included", async () => {
    const chromium = { enabled: true, endpoint: "wss://browser.example/cdp?token=abc" };

    await createCaller().updatePageRenderers({ ...STORED, chromium });

    expect(setConfig).toHaveBeenCalledWith(
      ServerConfigKeys.PAGE_RENDERERS,
      { ...STORED, chromium },
      createMockAdminUser().id,
      true,
      expect.anything()
    );
  });

  it.each([
    ["Chromium browser", { chromium: { enabled: true, endpoint: " " } }],
    ["solver", { solver: { enabled: true } }],
  ])("refuses a %s switched on without an endpoint", async (_renderer, change) => {
    await expect(createCaller().updatePageRenderers({ ...STORED, ...change })).rejects.toThrow(
      /Endpoint is required/
    );
    expect(setConfig).not.toHaveBeenCalled();
  });

  it("refuses a non-admin", async () => {
    await expect(createCaller(false).updatePageRenderers(STORED)).rejects.toThrow(
      /Server admin access required/i
    );
    expect(setConfig).not.toHaveBeenCalled();
  });
});

describe("testPageRenderer", () => {
  it("tests the endpoint as typed, not the stored one", async () => {
    testEndpoint.mockResolvedValue({ success: false, error: "connect ECONNREFUSED" });

    await expect(
      createCaller().testPageRenderer({ renderer: "solver", endpoint: " http://byparr:8191/v1 " })
    ).resolves.toEqual({ success: false, error: "connect ECONNREFUSED" });
    expect(testEndpoint).toHaveBeenCalledWith("solver", "http://byparr:8191/v1");
  });

  it("refuses a non-admin", async () => {
    await expect(
      createCaller(false).testPageRenderer({
        renderer: "chromium",
        endpoint: "http://chromium:9222",
      })
    ).rejects.toThrow(/Server admin access required/i);
    expect(testEndpoint).not.toHaveBeenCalled();
  });
});
