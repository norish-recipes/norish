import { describe, expect, it } from "vitest";

import {
  addableProviders,
  hasPassword,
  keepsOfferedSignInMethod,
  showsSignInMethods,
} from "../../src/contracts/dto/auth";

const pw = { id: "a1", providerId: "credential" };
const sso = { id: "a2", providerId: "oidc" };

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

    expect(keepsOfferedSignInMethod([pw], "a1", offered)).toBe(false);
    expect(keepsOfferedSignInMethod([pw, sso], "a1", offered)).toBe(true);
    // A method the server stopped offering does not count as one left.
    expect(keepsOfferedSignInMethod([pw, sso], "a1", new Set(["credential"]))).toBe(false);
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
