import { describe, expect, it } from "vitest";

import { passwordChecks } from "../../src/lib/auth/password";

describe("the new password", () => {
  const form = { current: "old-pass", next: "new-password", confirmation: "new-password" };

  it("goes when long enough and confirmed", () => {
    expect(passwordChecks(form).valid).toBe(true);
  });

  it("flags too short, too long and a mismatch", () => {
    expect(passwordChecks({ ...form, next: "short", confirmation: "short" })).toMatchObject({
      tooShort: true,
      valid: false,
    });
    expect(passwordChecks({ ...form, next: "x".repeat(129) }).tooLong).toBe(true);
    expect(passwordChecks({ ...form, confirmation: "other" })).toMatchObject({
      mismatch: true,
      valid: false,
    });
  });

  it("needs the current password", () => {
    expect(passwordChecks({ ...form, current: "" }).valid).toBe(false);
  });
});
