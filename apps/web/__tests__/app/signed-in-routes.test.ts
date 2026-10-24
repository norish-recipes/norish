// @vitest-environment node
/**
 * The proxy only checks that a session cookie is present, so every route
 * handler under the signed-in app checks the session behind it. A handler
 * added later without that check fails here rather than serving anyone.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SIGNED_IN_APP = path.join(__dirname, "../../app/(app)");
const SESSION_CHECKS = ["refuseWithoutSession(", "refuseUnlessViewer(", "auth.api.getSession("];

const handlers = readdirSync(SIGNED_IN_APP, { recursive: true, encoding: "utf8" })
  .filter((file) => path.basename(file) === "route.ts")
  .sort();

describe("the signed-in app's route handlers", () => {
  it("are found", () => {
    expect(handlers.length).toBeGreaterThan(0);
  });

  it.each(handlers)("%s checks the session", (file) => {
    const source = readFileSync(path.join(SIGNED_IN_APP, file), "utf8");

    expect(SESSION_CHECKS.some((check) => source.includes(check))).toBe(true);
  });
});
