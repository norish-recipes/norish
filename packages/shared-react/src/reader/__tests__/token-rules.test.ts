import { describe, expect, it } from "vitest";

import { apiKeyName, apiKeyPrefix, orderedSiteAuthTokens, siteAuthTokenForm } from "..";

describe("token rules", () => {
  it("shows a key by its kept start, or stars when it kept none", () => {
    expect(apiKeyPrefix("abc123")).toBe("abc123...");
    expect(apiKeyPrefix(null)).toBe("***...");
    expect(apiKeyPrefix("")).toBe("***...");
  });

  it("sends a key's name trimmed, and none for a blank one so the server names it", () => {
    expect(apiKeyName("  Shortcut ")).toBe("Shortcut");
    expect(apiKeyName("   ")).toBeUndefined();
    expect(apiKeyName("")).toBeUndefined();
  });

  it("orders tokens by domain, account, then name", () => {
    const token = (domain: string, account: string | null, name: string) => ({
      domain,
      account,
      name,
    });
    const ordered = orderedSiteAuthTokens([
      token("b.com", null, "x"),
      token("a.com", "zed", "x"),
      token("a.com", "amy", "y"),
      token("a.com", "amy", "x"),
    ]);

    expect(ordered.map((t) => `${t.domain}/${t.account}/${t.name}`)).toEqual([
      "a.com/amy/x",
      "a.com/amy/y",
      "a.com/zed/x",
      "b.com/null/x",
    ]);
  });

  it("flags a bare domain and needs domain, name and value to add", () => {
    expect(siteAuthTokenForm({ domain: "instagram", name: "n", value: "v" })).toEqual({
      domainBare: true,
      valid: false,
    });
    expect(siteAuthTokenForm({ domain: "", name: "n", value: "v" })).toEqual({
      domainBare: false,
      valid: false,
    });
    expect(siteAuthTokenForm({ domain: "instagram.com", name: " ", value: "v" }).valid).toBe(false);
    expect(siteAuthTokenForm({ domain: "instagram.com", name: "n", value: "v" }).valid).toBe(true);
  });
});
