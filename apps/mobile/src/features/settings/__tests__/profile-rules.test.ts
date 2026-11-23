import { describe, expect, it } from "vitest";

import {
  addableProviders,
  afterSave,
  canSaveProfile,
  canUnlink,
  hasPassword,
  nameToSend,
  passwordChecks,
  shownName,
  showsSignInMethods,
} from "../utils/profile-rules";

const pw = { id: "a1", providerId: "credential" };
const sso = { id: "a2", providerId: "oidc" };
const base = { draft: null, savedName: "Ada", hasNewPhoto: false, saving: false, offline: false };

describe("the name field", () => {
  it("shows the saved name until something is typed, and the draft after", () => {
    expect(shownName(null, "Ada")).toBe("Ada");
    expect(shownName("Eve", "Ada")).toBe("Eve");
  });

  it("shows a name from another device when nothing is typed, and keeps a draft over it", () => {
    expect(shownName(null, "Grace")).toBe("Grace");
    expect(shownName("Eve", "Grace")).toBe("Eve");
  });

  it("sends the trimmed draft, and nothing when trimming leaves the saved name", () => {
    expect(nameToSend(null, "Ada")).toBeNull();
    expect(nameToSend(" Eve ", "Ada")).toBe("Eve");
    expect(nameToSend("Ada ", "Ada")).toBeNull();
    expect(nameToSend("   ", "Ada")).toBe("");
  });

  it("sends a draft that now differs because another device renamed", () => {
    expect(nameToSend("Ada", "Grace")).toBe("Ada");
  });
});

describe("after a save", () => {
  it("drops what the save took", () => {
    expect(afterSave("Eve", "Eve", true)).toBeNull();
  });

  it("keeps the draft when the save failed, was refused or was stale", () => {
    expect(afterSave("Eve", "Eve", false)).toBe("Eve");
  });

  it("keeps text typed while the save was in flight", () => {
    expect(afterSave("Eve Smith", "Eve", true)).toBe("Eve Smith");
    expect(afterSave("Eve Smith", "Eve", false)).toBe("Eve Smith");
  });

  it("keeps a photo staged while the save was in flight", () => {
    const sent = { uri: "a" };
    const later = { uri: "b" };

    expect(afterSave(sent, sent, true)).toBeNull();
    expect(afterSave(later, sent, true)).toBe(later);
  });
});

describe("saving the profile", () => {
  it("needs a changed name or a new photo", () => {
    expect(canSaveProfile(base)).toBe(false);
    expect(canSaveProfile({ ...base, draft: "Eve" })).toBe(true);
    expect(canSaveProfile({ ...base, hasNewPhoto: true })).toBe(true);
    expect(canSaveProfile({ ...base, draft: "Eve", hasNewPhoto: true })).toBe(true);
  });

  it("is off for an edit that only adds whitespace, unless a photo waits", () => {
    expect(canSaveProfile({ ...base, draft: "Ada  " })).toBe(false);
    expect(canSaveProfile({ ...base, draft: "Ada  ", hasNewPhoto: true })).toBe(true);
  });

  it("stays on for an empty name, which the save refuses and says why", () => {
    expect(canSaveProfile({ ...base, draft: "" })).toBe(true);
  });

  it("is off while saving and while Offline", () => {
    expect(canSaveProfile({ ...base, draft: "Eve", saving: true })).toBe(false);
    expect(canSaveProfile({ ...base, draft: "Eve", offline: true })).toBe(false);
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
