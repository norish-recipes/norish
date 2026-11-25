// @vitest-environment node
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({
  UPLOADS_DIR: "",
  MASTER_KEY: undefined as string | undefined,
  MASTER_KEY_PREVIOUS: undefined as string | undefined,
}));

vi.mock("@norish/config/env-config-server", () => ({ SERVER_CONFIG: config }));

const { keyFilePath, readKeyFile, writeKeyFile } = await import("@norish/shared-server/master-key");

const keyDir = () => path.dirname(keyFilePath());
const modeOf = async (target: string) => (await fs.stat(target)).mode & 0o777;

beforeEach(() => {
  config.UPLOADS_DIR = path.join(
    mkdtempSync(path.join(os.tmpdir(), "master-key-test-")),
    "uploads"
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the key file", () => {
  it("lives under the uploads, readable by this user only, in a folder no one else can list", async () => {
    const current = randomBytes(32);

    await writeKeyFile({ current });

    expect(keyFilePath()).toBe(path.join(config.UPLOADS_DIR, ".norish", "master-key.json"));
    expect(await modeOf(keyFilePath())).toBe(0o600);
    expect(await modeOf(keyDir())).toBe(0o700);
    expect(await readKeyFile()).toEqual({ current });
  });

  it("keeps a previous key beside the current one", async () => {
    const keys = { current: randomBytes(32), previous: randomBytes(32) };

    await writeKeyFile(keys);

    expect(await readKeyFile()).toEqual(keys);
  });

  it("closes a folder someone opened up", async () => {
    await fs.mkdir(keyDir(), { recursive: true, mode: 0o755 });
    await fs.chmod(keyDir(), 0o755);

    await writeKeyFile({ current: randomBytes(32) });

    expect(await modeOf(keyDir())).toBe(0o700);
  });

  it("is none when there is no file", async () => {
    expect(await readKeyFile()).toBeNull();
  });

  it("refuses a file that is not a key file without repeating what it holds", async () => {
    await fs.mkdir(keyDir(), { recursive: true });
    await fs.writeFile(keyFilePath(), '{"current":"sekrit-not-a-key"}');

    const refusal = readKeyFile();

    await expect(refusal).rejects.toThrow(`${keyFilePath()} is not a Norish key file`);
    await expect(refusal).rejects.not.toThrow(/sekrit/);
  });

  it("leaves the old file whole, and no half-written one, when a write fails", async () => {
    const old = { current: randomBytes(32) };

    await writeKeyFile(old);
    vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("disk gone"));

    await expect(writeKeyFile({ current: randomBytes(32) })).rejects.toThrow("disk gone");

    expect(await readKeyFile()).toEqual(old);
    expect(await fs.readdir(keyDir())).toEqual(["master-key.json"]);
  });
});
