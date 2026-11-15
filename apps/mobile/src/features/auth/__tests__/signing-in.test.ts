import { SIGN_IN_DEADLINE_MS } from "@/features/auth/utils/auth-failure";
import { resolveSigningIn } from "@/features/auth/utils/signing-in";
import { describe, expect, it } from "vitest";

describe("resolveSigningIn", () => {
  it("waits for the session until the sign-in deadline", () => {
    expect(resolveSigningIn(false, 0)).toBe("wait");
    expect(resolveSigningIn(false, SIGN_IN_DEADLINE_MS - 1)).toBe("wait");
  });

  it("fails once the deadline passes with no session", () => {
    expect(resolveSigningIn(false, SIGN_IN_DEADLINE_MS)).toBe("failed");
  });

  it("hands over to the signed-in app whenever a session arrives", () => {
    expect(resolveSigningIn(true, 0)).toBe("signed-in");
    expect(resolveSigningIn(true, SIGN_IN_DEADLINE_MS)).toBe("signed-in");
  });
});
