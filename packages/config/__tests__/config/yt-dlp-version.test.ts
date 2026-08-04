// @vitest-environment node
/**
 * The yt-dlp version Norish reports must be the one it ships.
 *
 * The version lived as a literal in the env default, the seeded video config,
 * the admin screen and the Docker build at once, and the copies drifted: the
 * admin screen named a release two upgrades behind the binary in the image,
 * which is exactly the field an operator is told to check when Instagram
 * imports start failing (#513).
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_YT_DLP_VERSION } from "@norish/config/zod/server-config";

const dockerfile = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../../../docker/Dockerfile"),
  "utf8"
);

describe("DEFAULT_YT_DLP_VERSION", () => {
  it("names a yt-dlp release", () => {
    expect(DEFAULT_YT_DLP_VERSION).toMatch(/^\d{4}\.\d{2}\.\d{2}(\.\d+)?$/);
  });

  it("is the version the Docker image downloads", () => {
    const arg = /^ARG YT_DLP_VERSION=(.+)$/m.exec(dockerfile);

    expect(arg?.[1]).toBe(DEFAULT_YT_DLP_VERSION);
  });

  it("is what YT_DLP_VERSION falls back to", async () => {
    const { SERVER_CONFIG } = await import("@norish/config/env-config-server");

    expect(SERVER_CONFIG.YT_DLP_VERSION).toBe(DEFAULT_YT_DLP_VERSION);
  });
});
