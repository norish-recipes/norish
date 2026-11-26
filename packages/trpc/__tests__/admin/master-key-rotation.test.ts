// @vitest-environment node
/**
 * The Admin action that rotates a generated Master Key: admin-only, refused in env mode, the new
 * key file on disk before the restart, and no key in an answer or a log line.
 */
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { masterKeyFingerprint } from "@norish/config/crypto";
import { keyFilePath, readKeyFile, writeKeyFile } from "@norish/shared-server/master-key";
import { systemProcedures } from "@norish/trpc/routers/admin/system";

import { isUserServerAdmin } from "../mocks/users";
import { createMockAdminContext, createMockAdminUser, createMockUser } from "./test-utils";

const config = vi.hoisted(() => ({
  UPLOADS_DIR: "",
  MASTER_KEY: undefined as string | undefined,
  MASTER_KEY_PREVIOUS: undefined as string | undefined,
}));
const database = vi.hoisted(() => ({ fingerprint: null as string | null }));
const logged = vi.hoisted(() => [] as unknown[]);

vi.mock("@norish/config/env-config-server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/config/env-config-server")>()),
  SERVER_CONFIG: config,
}));
vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));
vi.mock("@norish/db/repositories/master-key", () => ({
  getMasterKeyFingerprint: async () => database.fingerprint,
}));
vi.mock("@norish/shared-server/logger", () => {
  const record = (...args: unknown[]) => void logged.push(args);
  const logger = { debug: record, info: record, warn: record, error: record };

  return { trpcLogger: logger, serverLogger: logger, createLogger: () => logger };
});

const keyA = randomBytes(32).toString("base64");
const keyB = randomBytes(32).toString("base64");

function createCaller(admin = true) {
  const ctx = createMockAdminContext(admin ? createMockAdminUser() : createMockUser());

  return systemProcedures.createCaller(ctx as never);
}

const exitsScheduled = () => vi.getTimerCount();

beforeEach(() => {
  config.UPLOADS_DIR = path.join(mkdtempSync(path.join(os.tmpdir(), "rotate-key-test-")), "up");
  config.MASTER_KEY = undefined;
  config.MASTER_KEY_PREVIOUS = undefined;
  database.fingerprint = masterKeyFingerprint(Buffer.from(keyA, "base64"));
  logged.length = 0;
  isUserServerAdmin.mockImplementation(async (id: string) => id === createMockAdminUser().id);
  vi.useFakeTimers();
  vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("rotating the Master Key from the Admin action", () => {
  it("writes the new key file, then restarts, answering and logging no key", async () => {
    await writeKeyFile({ current: keyA });

    const answer = await createCaller().rotateMasterKey();
    // Written before the answer, so before the restart the answer schedules.
    const written = await readKeyFile();

    expect(answer).toEqual({ success: true });
    expect(written?.previous).toBe(keyA);
    expect(written?.current).not.toBe(keyA);
    expect(process.exit).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(process.exit).toHaveBeenCalledWith(0);

    const said = JSON.stringify([answer, logged]);

    for (const key of [keyA, written?.current ?? ""]) expect(said).not.toContain(key);
  });

  it("keeps the key the data is on when a rotation is still waiting for its boot", async () => {
    await writeKeyFile({ current: keyB, previous: keyA });

    await createCaller().rotateMasterKey();

    expect((await readKeyFile())?.previous).toBe(keyA);
  });

  it("is refused in env mode, writing nothing and staying up", async () => {
    config.MASTER_KEY = keyA;

    await expect(createCaller().rotateMasterKey()).resolves.toEqual({
      success: false,
      error: "MASTER_KEY is set, so rotate it there with MASTER_KEY_PREVIOUS.",
    });
    await expect(fs.access(path.dirname(keyFilePath()))).rejects.toThrow("ENOENT");
    expect(exitsScheduled()).toBe(0);
  });

  it("says nothing changed and stays up when the new key file cannot be put in place", async () => {
    await writeKeyFile({ current: keyA });
    vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("ENOSPC: no space left on device"));

    await expect(createCaller().rotateMasterKey()).resolves.toEqual({
      success: false,
      error: "The new key could not be written, so nothing changed.",
    });
    expect(await readKeyFile()).toEqual({ current: keyA });
    expect(exitsScheduled()).toBe(0);
    expect(JSON.stringify(logged)).not.toContain(keyA);
  });

  it("is admin-only, writing nothing", async () => {
    await writeKeyFile({ current: keyA });

    await expect(createCaller(false).rotateMasterKey()).rejects.toThrow(
      "Server admin access required"
    );
    expect(await readKeyFile()).toEqual({ current: keyA });
    expect(exitsScheduled()).toBe(0);
  });
});

describe("the Master Key source the System card reads", () => {
  it("is pinned when MASTER_KEY is set, as boot decides it", async () => {
    config.MASTER_KEY = keyA;

    await expect(createCaller().getMasterKeySource()).resolves.toEqual({ pinned: true });
  });

  it("is the key file when MASTER_KEY is unset", async () => {
    await expect(createCaller().getMasterKeySource()).resolves.toEqual({ pinned: false });
  });

  it("is admin-only", async () => {
    await expect(createCaller(false).getMasterKeySource()).rejects.toThrow(
      "Server admin access required"
    );
  });
});
