import { describe, expect, it } from "vitest";

import { classifyServerHealth, MINIMUM_SERVER_VERSION } from "@/features/auth/utils/server-version";

describe("classifyServerHealth", () => {
  it("is not Norish for a body that isn't a Norish health response", () => {
    expect(classifyServerHealth(null)).toBe("not-norish");
    expect(classifyServerHealth("<html>")).toBe("not-norish");
    expect(classifyServerHealth({ status: "ok" })).toBe("not-norish");
    expect(classifyServerHealth({ version: "0.27.0" })).toBe("not-norish");
  });

  it("is too old for a Norish response before the version field, or below the minimum", () => {
    // 0.25's shape: no `version`, only its old `versions` report.
    expect(
      classifyServerHealth({
        status: "ok",
        db: { status: "ok" },
        versions: { root: "0.25.1-beta", apps: {}, packages: {} },
        parser: { status: "ok" },
      })
    ).toBe("too-old");
    expect(classifyServerHealth({ status: "ok", version: "0.1.0", parser: {} })).toBe("too-old");
  });

  it("is ok for a Norish response at the minimum version or later", () => {
    const ready = { status: "ok", db: { status: "ok" }, parser: { status: "unreachable" } };

    expect(classifyServerHealth({ ...ready, version: MINIMUM_SERVER_VERSION })).toBe("ok");
    expect(classifyServerHealth({ ...ready, version: "99.0.0" })).toBe("ok");
  });
});
