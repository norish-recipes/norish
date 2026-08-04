// @vitest-environment node
/**
 * What the admin video screen is told about the downloader.
 *
 * The screen used to offer a **yt-dlp Version** an administrator could edit and
 * save, which nothing on the server ever read — so across the fleet it showed
 * the environment value on fresh installs, a stale string on older ones, or
 * whatever someone had typed. The troubleshooting docs sent operators to it
 * precisely when imports broke.
 *
 * It is a report now, so what matters is that the value reaching the screen is
 * the binary's own answer, and that "no binary" arrives as itself rather than
 * dressed up as a version.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getYtDlpVersion } from "@norish/shared-server/video/yt-dlp-version";
import { videoRuntimeProcedures } from "@norish/trpc/routers/admin/video-runtime";

import { isUserServerAdmin } from "../mocks/users";
import { createMockAdminContext, createMockAdminUser, createMockUser } from "./test-utils";

vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));
vi.mock("@norish/shared-server/video/yt-dlp-version", () => ({ getYtDlpVersion: vi.fn() }));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const lookup = vi.mocked(getYtDlpVersion);

function createCaller(admin = true) {
  const ctx = createMockAdminContext(admin ? createMockAdminUser() : createMockUser());

  return videoRuntimeProcedures.createCaller({ ...ctx, multiplexer: null } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  isUserServerAdmin.mockImplementation((userId: string) =>
    Promise.resolve(userId === createMockAdminUser().id)
  );
});

describe("the yt-dlp version the admin screen receives", () => {
  it("is the release the binary reports", async () => {
    lookup.mockResolvedValue("2026.07.04");

    await expect(createCaller().getYtDlpVersion()).resolves.toEqual({ version: "2026.07.04" });
  });

  it("says there is no binary rather than reporting a version", async () => {
    lookup.mockResolvedValue(null);

    await expect(createCaller().getYtDlpVersion()).resolves.toEqual({ version: null });
  });

  it("is admin-only", async () => {
    lookup.mockResolvedValue("2026.07.04");

    await expect(createCaller(false).getYtDlpVersion()).rejects.toThrow(
      /Server admin access required/i
    );
  });
});
