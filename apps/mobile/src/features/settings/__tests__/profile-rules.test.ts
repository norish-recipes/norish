import { describe, expect, it } from "vitest";

import {
  addableProviders,
  canSaveProfile,
  canUnlink,
  hasPassword,
  passwordChecks,
  showsSignInMethods,
} from "../utils/profile-rules";

const pw = { id: "a1", providerId: "credential" };
const sso = { id: "a2", providerId: "oidc" };
const base = { name: "Ada", savedName: "Ada", hasNewPhoto: false, saving: false, offline: false };

describe("saving the profile", () => {
  it("needs a changed name or a new photo", () => {
    expect(canSaveProfile(base)).toBe(false);
    expect(canSaveProfile({ ...base, name: "Eve" })).toBe(true);
    expect(canSaveProfile({ ...base, hasNewPhoto: true })).toBe(true);
  });

  it("is off while saving and while Offline", () => {
    expect(canSaveProfile({ ...base, name: "Eve", saving: true })).toBe(false);
    expect(canSaveProfile({ ...base, name: "Eve", offline: true })).toBe(false);
  });
});

describe("sign-in methods", () => {
  it("offers the password sheet only when the server offers and the account has a password", () => {
    expect(hasPassword([pw], new Set(["credential"]))).toBe(true);
    expect(hasPassword([pw], new Set(["oidc"]))).toBe(false);
    expect(hasPassword([sso], new Set(["credential", "oidc"]))).toBe(false);
  });

  it("hides the list with one method on the server and no password", () => {
    expect(showsSignInMethods(1, false)).toBe(false);
    expect(showsSignInMethods(1, true)).toBe(true);
    expect(showsSignInMethods(2, false)).toBe(true);
  });

  it("refuses to remove the last offered method", () => {
    const offered = new Set(["credential", "oidc"]);

    expect(canUnlink([pw], "a1", offered)).toBe(false);
    expect(canUnlink([pw, sso], "a1", offered)).toBe(true);
    // A method the server stopped offering does not count as one left.
    expect(canUnlink([pw, sso], "a1", new Set(["credential"]))).toBe(false);
  });

  it("lists the oauth providers not yet linked", () => {
    const providers = [
      { id: "credential", name: "Email", icon: "", type: "credential" as const },
      { id: "oidc", name: "SSO", icon: "", type: "oauth" as const },
      { id: "github", name: "GitHub", icon: "", type: "oauth" as const },
    ];

    expect(addableProviders(providers, [pw, sso]).map((p) => p.id)).toEqual(["github"]);
  });
});

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
