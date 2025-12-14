import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import {
  getCaldavConfigWithoutPassword,
  getCaldavConfigDecrypted,
  saveCaldavConfig,
  deleteCaldavConfig,
} from "../../mocks/caldav-config";
import { getCaldavSyncStatusesByUser, getSyncStatusSummary } from "../../mocks/caldav-sync-status";
import { caldavEmitter } from "../../mocks/caldav-emitter";
import { syncAllFutureItems, retryFailedSyncs } from "../../mocks/caldav-calendar-sync";

import {
  createMockUser,
  createMockAuthedContext,
  createMockCaldavConfig,
  createMockCaldavConfigWithoutPassword,
  createMockSyncStatusView,
  createMockSyncSummary,
} from "./test-utils";

// @vitest-environment node

// Setup mocks before any imports that use them
vi.mock("@/server/db/repositories/caldav-config", () => import("../../mocks/caldav-config"));
vi.mock(
  "@/server/db/repositories/caldav-sync-status",
  () => import("../../mocks/caldav-sync-status")
);
vi.mock("@/server/trpc/routers/caldav/emitter", () => import("../../mocks/caldav-emitter"));
vi.mock("@/server/caldav/event-listener", () => import("../../mocks/caldav-calendar-sync"));
vi.mock("@/config/server-config-loader", () => import("../../mocks/config"));

// Mock global fetch for connection testing
const mockFetch = vi.fn();

global.fetch = mockFetch;

// Create a test tRPC instance
const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

// Create test caller factory with inline procedures that mirror the actual implementation
function createTestCaller(ctx: ReturnType<typeof createMockAuthedContext>) {
  const testRouter = t.router({
    getConfig: t.procedure.query(async () => {
      const userId = ctx.user.id;
      const config = await getCaldavConfigWithoutPassword(userId);

      return config ?? null;
    }),

    getPassword: t.procedure.query(async () => {
      const userId = ctx.user.id;
      const config = await getCaldavConfigDecrypted(userId);

      return config?.password ?? null;
    }),

    saveConfig: t.procedure
      .input(
        (v) =>
          v as {
            serverUrl: string;
            username: string;
            password: string;
            enabled: boolean;
            breakfastTime: string;
            lunchTime: string;
            dinnerTime: string;
            snackTime: string;
          }
      )
      .mutation(async ({ input }) => {
        const userId = ctx.user.id;

        // First test connection
        const authHeader =
          "Basic " + Buffer.from(`${input.username}:${input.password}`).toString("base64");

        const response = await fetch(input.serverUrl, {
          method: "PROPFIND",
          headers: {
            Authorization: authHeader,
            Depth: "0",
          },
        });

        if (!response.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Connection failed: ${response.status} ${response.statusText}`,
          });
        }

        // Save config
        await saveCaldavConfig(userId, input);

        // Get the saved config without password
        const savedConfig = await getCaldavConfigWithoutPassword(userId);

        // Emit event
        caldavEmitter.emitToUser(userId, "configSaved", { config: savedConfig });

        // If enabled, trigger sync
        if (input.enabled) {
          syncAllFutureItems(userId);
        }

        return savedConfig;
      }),

    testConnection: t.procedure
      .input((v) => v as { serverUrl: string; username: string; password: string })
      .mutation(async ({ input }) => {
        try {
          const authHeader =
            "Basic " + Buffer.from(`${input.username}:${input.password}`).toString("base64");

          const response = await fetch(input.serverUrl, {
            method: "PROPFIND",
            headers: {
              Authorization: authHeader,
              Depth: "0",
            },
          });

          if (!response.ok) {
            return {
              success: false,
              message: `Connection failed: ${response.status} ${response.statusText}`,
            };
          }

          return {
            success: true,
            message: "Connection successful",
          };
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Connection test failed",
          };
        }
      }),

    deleteConfig: t.procedure
      .input((v) => v as { deleteEvents: boolean })
      .mutation(async () => {
        const userId = ctx.user.id;

        await deleteCaldavConfig(userId);

        caldavEmitter.emitToUser(userId, "configSaved", { config: null });

        return { success: true };
      }),

    getSyncStatus: t.procedure
      .input((v) => v as { page: number; pageSize: number; statusFilter?: string })
      .query(async ({ input }) => {
        const userId = ctx.user.id;
        const filters = input.statusFilter ? [input.statusFilter] : undefined;

        const result = await getCaldavSyncStatusesByUser(
          userId,
          filters,
          input.page,
          input.pageSize
        );

        return {
          statuses: result.items,
          total: result.total,
          page: input.page,
          pageSize: input.pageSize,
        };
      }),

    getSummary: t.procedure.query(async () => {
      const userId = ctx.user.id;

      return getSyncStatusSummary(userId);
    }),

    triggerSync: t.procedure.mutation(async () => {
      const userId = ctx.user.id;

      caldavEmitter.emitToUser(userId, "syncStarted", {
        timestamp: new Date().toISOString(),
      });

      retryFailedSyncs(userId);

      return { started: true };
    }),

    syncAll: t.procedure.mutation(async () => {
      const userId = ctx.user.id;

      caldavEmitter.emitToUser(userId, "syncStarted", {
        timestamp: new Date().toISOString(),
      });

      syncAllFutureItems(userId);

      return { started: true };
    }),
  });

  return t.createCallerFactory(testRouter)(ctx);
}

describe("CalDAV tRPC Procedures", () => {
  const testUser = createMockUser();
  const testCtx = createMockAuthedContext(testUser);

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    (getCaldavConfigWithoutPassword as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getCaldavConfigDecrypted as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getCaldavSyncStatusesByUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
      total: 0,
    });
    (getSyncStatusSummary as ReturnType<typeof vi.fn>).mockResolvedValue(createMockSyncSummary());
    mockFetch.mockResolvedValue({ ok: true } as Response);
  });

  describe("getConfig", () => {
    it("should return null when no config exists", async () => {
      const caller = createTestCaller(testCtx);
      const result = await caller.getConfig();

      expect(result).toBeNull();
      expect(getCaldavConfigWithoutPassword).toHaveBeenCalledWith(testUser.id);
    });

    it("should return config without password when it exists", async () => {
      const mockConfig = createMockCaldavConfigWithoutPassword({
        userId: testUser.id,
      });

      (getCaldavConfigWithoutPassword as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfig);

      const caller = createTestCaller(testCtx);
      const result = await caller.getConfig();

      expect(result).toEqual(mockConfig);
      expect(result).not.toHaveProperty("password");
    });
  });

  describe("getPassword", () => {
    it("should return null when no config exists", async () => {
      const caller = createTestCaller(testCtx);
      const result = await caller.getPassword();

      expect(result).toBeNull();
    });

    it("should return password when config exists", async () => {
      const mockConfig = createMockCaldavConfig({
        userId: testUser.id,
        password: "secretpassword",
      });

      (getCaldavConfigDecrypted as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfig);

      const caller = createTestCaller(testCtx);
      const result = await caller.getPassword();

      expect(result).toBe("secretpassword");
    });
  });

  describe("saveConfig", () => {
    const validInput = {
      serverUrl: "https://caldav.example.com",
      username: "testuser",
      password: "testpassword",
      enabled: true,
      breakfastTime: "08:00-09:00",
      lunchTime: "12:00-13:00",
      dinnerTime: "18:00-19:00",
      snackTime: "15:00-15:30",
    };

    it("should save config and emit event when connection succeeds", async () => {
      const mockSavedConfig = createMockCaldavConfigWithoutPassword({
        userId: testUser.id,
      });

      (saveCaldavConfig as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (getCaldavConfigWithoutPassword as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockSavedConfig
      );

      const caller = createTestCaller(testCtx);
      const result = await caller.saveConfig(validInput);

      expect(saveCaldavConfig).toHaveBeenCalledWith(testUser.id, validInput);
      expect(caldavEmitter.emitToUser).toHaveBeenCalledWith(testUser.id, "configSaved", {
        config: mockSavedConfig,
      });
      expect(result).toEqual(mockSavedConfig);
    });

    it("should trigger sync when enabled", async () => {
      const mockSavedConfig = createMockCaldavConfigWithoutPassword({
        userId: testUser.id,
      });

      (getCaldavConfigWithoutPassword as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockSavedConfig
      );

      const caller = createTestCaller(testCtx);

      await caller.saveConfig({ ...validInput, enabled: true });

      expect(syncAllFutureItems).toHaveBeenCalledWith(testUser.id);
    });

    it("should not trigger sync when disabled", async () => {
      const mockSavedConfig = createMockCaldavConfigWithoutPassword({
        userId: testUser.id,
        enabled: false,
      });

      (getCaldavConfigWithoutPassword as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockSavedConfig
      );

      const caller = createTestCaller(testCtx);

      await caller.saveConfig({ ...validInput, enabled: false });

      expect(syncAllFutureItems).not.toHaveBeenCalled();
    });

    it("should throw error when connection fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response);

      const caller = createTestCaller(testCtx);

      await expect(caller.saveConfig(validInput)).rejects.toThrow(
        "Connection failed: 401 Unauthorized"
      );
      expect(saveCaldavConfig).not.toHaveBeenCalled();
    });
  });

  describe("testConnection", () => {
    it("should return success when connection succeeds", async () => {
      mockFetch.mockResolvedValue({ ok: true } as Response);

      const caller = createTestCaller(testCtx);
      const result = await caller.testConnection({
        serverUrl: "https://caldav.example.com",
        username: "testuser",
        password: "testpassword",
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("Connection successful");
    });

    it("should return failure when connection fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      } as Response);

      const caller = createTestCaller(testCtx);
      const result = await caller.testConnection({
        serverUrl: "https://caldav.example.com",
        username: "testuser",
        password: "wrongpassword",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Connection failed");
    });

    it("should return failure when fetch throws", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const caller = createTestCaller(testCtx);
      const result = await caller.testConnection({
        serverUrl: "https://invalid.example.com",
        username: "testuser",
        password: "testpassword",
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Network error");
    });
  });

  describe("deleteConfig", () => {
    it("should delete config and emit null event", async () => {
      const caller = createTestCaller(testCtx);
      const result = await caller.deleteConfig({ deleteEvents: false });

      expect(deleteCaldavConfig).toHaveBeenCalledWith(testUser.id);
      expect(caldavEmitter.emitToUser).toHaveBeenCalledWith(testUser.id, "configSaved", {
        config: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("getSyncStatus", () => {
    it("should return empty list when no statuses exist", async () => {
      const caller = createTestCaller(testCtx);
      const result = await caller.getSyncStatus({
        page: 1,
        pageSize: 20,
      });

      expect(result.statuses).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should return paginated sync statuses", async () => {
      const mockStatuses = [
        createMockSyncStatusView({ userId: testUser.id }),
        createMockSyncStatusView({ userId: testUser.id }),
      ];

      (getCaldavSyncStatusesByUser as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: mockStatuses,
        total: 2,
      });

      const caller = createTestCaller(testCtx);
      const result = await caller.getSyncStatus({
        page: 1,
        pageSize: 20,
      });

      expect(result.statuses).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it("should pass status filter to repository", async () => {
      const caller = createTestCaller(testCtx);

      await caller.getSyncStatus({
        page: 1,
        pageSize: 20,
        statusFilter: "failed",
      });

      expect(getCaldavSyncStatusesByUser).toHaveBeenCalledWith(testUser.id, ["failed"], 1, 20);
    });
  });

  describe("getSummary", () => {
    it("should return sync status summary", async () => {
      const mockSummary = createMockSyncSummary({
        pending: 5,
        synced: 10,
        failed: 2,
        removed: 1,
      });

      (getSyncStatusSummary as ReturnType<typeof vi.fn>).mockResolvedValue(mockSummary);

      const caller = createTestCaller(testCtx);
      const result = await caller.getSummary();

      expect(result).toEqual(mockSummary);
    });
  });

  describe("triggerSync", () => {
    it("should emit syncStarted and call retryFailedSyncs", async () => {
      const caller = createTestCaller(testCtx);
      const result = await caller.triggerSync();

      expect(caldavEmitter.emitToUser).toHaveBeenCalledWith(
        testUser.id,
        "syncStarted",
        expect.objectContaining({ timestamp: expect.any(String) })
      );
      expect(retryFailedSyncs).toHaveBeenCalledWith(testUser.id);
      expect(result.started).toBe(true);
    });
  });

  describe("syncAll", () => {
    it("should emit syncStarted and call syncAllFutureItems", async () => {
      const caller = createTestCaller(testCtx);
      const result = await caller.syncAll();

      expect(caldavEmitter.emitToUser).toHaveBeenCalledWith(
        testUser.id,
        "syncStarted",
        expect.objectContaining({ timestamp: expect.any(String) })
      );
      expect(syncAllFutureItems).toHaveBeenCalledWith(testUser.id);
      expect(result.started).toBe(true);
    });
  });
});
