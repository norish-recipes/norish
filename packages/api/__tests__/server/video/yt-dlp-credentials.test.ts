// @vitest-environment node
import { inspect } from "node:util";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import { downloadVideoAudio, getVideoMetadata } from "@norish/api/video/yt-dlp";

const secrets = vi.hoisted(() => ({
  header: "synthetic-header-secret-5f3a",
  proxy: "synthetic-proxy-password-9c1e",
}));
const logged = vi.hoisted(() => [] as unknown[][]);

// A yt-dlp that fails, printing its arguments as a verbose run would, and each header's value
// alone as its info JSON's http_headers do.
vi.mock("@norish/config/env-config-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/config/env-config-server")>();
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-dlp-credentials-"));

  fs.writeFileSync(
    path.join(dir, "yt-dlp"),
    '#!/bin/sh\necho "ERROR: refused $*" >&2\necho "seen $*"\nfor a; do echo "value ${a#*: }"; done\nexit 1\n',
    { mode: 0o755 }
  );

  return {
    ...actual,
    SERVER_CONFIG: { ...actual.SERVER_CONFIG, YT_DLP_BIN_DIR: dir, UPLOADS_DIR: dir },
  };
});
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getVideoConfig: async () => ({ ytDlpProxy: `http://norish:${secrets.proxy}@proxy.invalid:8080` }),
}));
vi.mock("@norish/shared-server/media/ffmpeg", () => ({ getFfmpegPath: () => null }));
vi.mock("@norish/shared-server/logger", () => {
  const record =
    (level: string) =>
    (...args: unknown[]) =>
      void logged.push([level, ...args]);
  const logger = {
    debug: record("debug"),
    info: record("info"),
    warn: record("warn"),
    error: record("error"),
  };

  return { videoLogger: logger, createLogger: () => logger };
});

const token: SiteAuthTokenDecryptedDto = {
  id: "token-id",
  userId: "user-id",
  domain: "example.com",
  name: "Authorization",
  value: `Bearer ${secrets.header}`,
  type: "header",
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Everything an error or a log line can show: message, stack, own fields and causes. */
const shown = (value: unknown) => inspect(value, { depth: Infinity });

beforeEach(() => {
  logged.length = 0;
});

describe("a failed yt-dlp run", () => {
  it.each([
    ["reading a video", () => getVideoMetadata("https://example.com/v", [token])],
    ["downloading its audio", () => downloadVideoAudio("https://example.com/v", [token])],
  ])(
    "keeps a saved header and the proxy's login out of the error and the logs when %s",
    async (_, run) => {
      const error = await run().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      // yt-dlp's own words still reach the error, so a refusal stays readable.
      expect(shown(error)).toContain("ERROR: refused");
      expect(logged.length).toBeGreaterThan(0);
      for (const secret of [secrets.header, secrets.proxy]) {
        expect(shown(error)).not.toContain(secret);
        expect(shown(logged)).not.toContain(secret);
      }
    }
  );

  it("masks a short header as its whole argument, leaving the rest of the error readable", async () => {
    const short = { ...token, name: "X-Token", value: "1" };
    const error = await getVideoMetadata("https://example.com/v1", [short]).catch(
      (caught: unknown) => caught
    );

    expect(shown(error)).toContain("--dump-json -- https://example.com/v1");
    expect(shown(error)).not.toContain("X-Token: 1");
  });
});
