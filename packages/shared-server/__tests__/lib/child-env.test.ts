// @vitest-environment node
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

import { childEnv } from "../../src/lib/child-env";

/** The environment a real child process started with `childEnv(extra)` sees. */
function spawnedEnv(extra?: Record<string, string>): Record<string, string> {
  const output = execFileSync(
    process.execPath,
    ["-e", "process.stdout.write(JSON.stringify(process.env))"],
    { env: childEnv(extra), encoding: "utf8" }
  );

  return JSON.parse(output);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("childEnv", () => {
  it("gives a child PATH and the caller's extras, never Norish's secrets", () => {
    vi.stubEnv("MASTER_KEY", "a-master-key");
    vi.stubEnv("DATABASE_URL", "postgresql://user:secret@db/norish");
    vi.stubEnv("AI_API_KEY", "an-ai-key");
    vi.stubEnv("OIDC_CLIENT_SECRET", "an-oidc-secret");

    const env = spawnedEnv({ PARSER_API_PARENT_PID: "42" });

    expect(env.PATH).toBe(process.env.PATH);
    expect(env.PARSER_API_PARENT_PID).toBe("42");
    expect(env).not.toHaveProperty("MASTER_KEY");
    expect(env).not.toHaveProperty("DATABASE_URL");
    expect(env).not.toHaveProperty("AI_API_KEY");
    expect(env).not.toHaveProperty("OIDC_CLIENT_SECRET");
  });

  it("passes the locale and proxy settings through, in either case", () => {
    vi.stubEnv("LC_ALL", "en_US.UTF-8");
    vi.stubEnv("HTTPS_PROXY", "http://proxy:3128");
    vi.stubEnv("no_proxy", "localhost");

    expect(childEnv()).toMatchObject({
      LC_ALL: "en_US.UTF-8",
      HTTPS_PROXY: "http://proxy:3128",
      no_proxy: "localhost",
    });
  });
});
