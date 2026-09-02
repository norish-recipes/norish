// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { SiteAuthTokenDecryptedDto } from "@norish/shared/contracts/dto/site-auth-tokens";
import {
  credentialSetsForUrl,
  getMatchingTokens,
  rotateCredentialSet,
} from "@norish/shared/lib/site-auth-tokens";

function makeToken(
  overrides: Partial<SiteAuthTokenDecryptedDto> & { domain: string }
): SiteAuthTokenDecryptedDto {
  return {
    id: "test-id",
    userId: "test-user",
    account: null,
    name: "Authorization",
    value: "Bearer token123",
    type: "header",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("getMatchingTokens", () => {
  describe("exact domain match", () => {
    it("matches a token whose domain equals the URL hostname", () => {
      const tokens = [makeToken({ domain: "instagram.com" })];
      const result = getMatchingTokens(tokens, "https://instagram.com/p/123");

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe("instagram.com");
    });
  });

  describe("subdomain match", () => {
    it("matches a token when the URL hostname is a subdomain of the token domain", () => {
      const tokens = [makeToken({ domain: "instagram.com" })];
      const result = getMatchingTokens(tokens, "https://www.instagram.com/p/123");

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe("instagram.com");
    });

    it("matches deeply nested subdomains", () => {
      const tokens = [makeToken({ domain: "example.com" })];
      const result = getMatchingTokens(tokens, "https://a.b.c.example.com/path");

      expect(result).toHaveLength(1);
    });
  });

  describe("no match", () => {
    it("does not return tokens whose domain differs from the URL hostname", () => {
      const tokens = [makeToken({ domain: "facebook.com" })];
      const result = getMatchingTokens(tokens, "https://instagram.com");

      expect(result).toHaveLength(0);
    });

    it("does not match when the token domain is a suffix but not a parent domain", () => {
      const tokens = [makeToken({ domain: "gram.com" })];
      const result = getMatchingTokens(tokens, "https://instagram.com");

      expect(result).toHaveLength(0);
    });
  });

  describe("multiple tokens matching same URL", () => {
    it("returns all tokens that match the URL", () => {
      const tokens = [
        makeToken({ id: "1", domain: "instagram.com" }),
        makeToken({ id: "2", domain: "instagram.com", name: "Cookie-Auth" }),
        makeToken({ id: "3", domain: "facebook.com" }),
      ];
      const result = getMatchingTokens(tokens, "https://www.instagram.com/p/123");

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(["1", "2"]);
    });
  });

  describe("empty tokens array", () => {
    it("returns an empty array when no tokens are provided", () => {
      const result = getMatchingTokens([], "https://instagram.com");

      expect(result).toEqual([]);
    });
  });

  describe("empty or whitespace URL", () => {
    it("returns an empty array for an empty string URL", () => {
      const tokens = [makeToken({ domain: "instagram.com" })];
      const result = getMatchingTokens(tokens, "");

      expect(result).toEqual([]);
    });

    it("returns an empty array for a whitespace-only URL", () => {
      const tokens = [makeToken({ domain: "instagram.com" })];
      const result = getMatchingTokens(tokens, "   ");

      expect(result).toEqual([]);
    });
  });

  describe("case insensitivity", () => {
    it("matches when the token domain has mixed case", () => {
      const tokens = [makeToken({ domain: "Instagram.COM" })];
      const result = getMatchingTokens(tokens, "https://instagram.com/p/123");

      expect(result).toHaveLength(1);
    });

    it("matches when the URL has mixed case", () => {
      const tokens = [makeToken({ domain: "instagram.com" })];
      const result = getMatchingTokens(tokens, "https://INSTAGRAM.COM/p/123");

      expect(result).toHaveLength(1);
    });
  });

  describe("bare word domain (no TLD)", () => {
    it("matches a full URL when token domain is just a bare word like 'instagram'", () => {
      const tokens = [makeToken({ domain: "instagram" })];
      const result = getMatchingTokens(tokens, "https://www.instagram.com/p/123");

      expect(result).toHaveLength(1);
    });

    it("matches a URL without subdomain when token domain has no TLD", () => {
      const tokens = [makeToken({ domain: "instagram" })];
      const result = getMatchingTokens(tokens, "https://instagram.com/p/123");

      expect(result).toHaveLength(1);
    });

    it("does not match unrelated domains that happen to contain the bare word", () => {
      // "notinstagram.com" starts with "notinstagram", not "instagram."
      const tokens = [makeToken({ domain: "instagram" })];
      const result = getMatchingTokens(tokens, "https://notinstagram.com");

      expect(result).toHaveLength(0);
    });

    it("matches when URL hostname is exactly the bare word", () => {
      const tokens = [makeToken({ domain: "instagram" })];
      const result = getMatchingTokens(tokens, "instagram");

      expect(result).toHaveLength(1);
    });
  });

  describe("bare domain input (no protocol)", () => {
    it("matches when the URL is a bare domain without a scheme", () => {
      const tokens = [makeToken({ domain: "instagram.com" })];
      const result = getMatchingTokens(tokens, "instagram.com");

      expect(result).toHaveLength(1);
    });

    it("matches a bare domain with a path", () => {
      const tokens = [makeToken({ domain: "instagram.com" })];
      const result = getMatchingTokens(tokens, "instagram.com/p/123");

      expect(result).toHaveLength(1);
    });
  });
});

describe("credentialSetsForUrl", () => {
  it("returns nothing when no token matches the site", () => {
    const tokens = [makeToken({ domain: "instagram.com" })];

    expect(credentialSetsForUrl(tokens, "https://example.com/recipe")).toEqual([]);
  });

  it("keeps an unlabelled domain as one set, so a server that never named an account is unaffected", () => {
    const tokens = [
      makeToken({ id: "t1", domain: "instagram.com", name: "sessionid", type: "cookie" }),
      makeToken({ id: "t2", domain: "instagram.com", name: "csrftoken", type: "cookie" }),
    ];
    const sets = credentialSetsForUrl(tokens, "https://www.instagram.com/p/123");

    expect(sets).toHaveLength(1);
    expect(sets[0]?.account).toBeNull();
    expect(sets[0]?.tokens.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("gives every account its own set", () => {
    const tokens = [
      makeToken({ id: "a", domain: "instagram.com", account: "alice", name: "sessionid" }),
      makeToken({ id: "b", domain: "instagram.com", account: "bob", name: "sessionid" }),
    ];
    const sets = credentialSetsForUrl(tokens, "https://www.instagram.com/p/123");

    expect(sets.map((s) => s.account)).toEqual(["alice", "bob"]);
    expect(sets.map((s) => s.tokens.map((t) => t.id))).toEqual([["a"], ["b"]]);
  });

  it("sends an unlabelled token with every account, since it belongs to no single login", () => {
    const tokens = [
      makeToken({ id: "shared", domain: "instagram.com", name: "csrftoken" }),
      makeToken({ id: "a", domain: "instagram.com", account: "alice", name: "sessionid" }),
      makeToken({ id: "b", domain: "instagram.com", account: "bob", name: "sessionid" }),
    ];
    const sets = credentialSetsForUrl(tokens, "https://www.instagram.com/p/123");

    expect(sets.map((s) => s.tokens.map((t) => t.id))).toEqual([
      ["shared", "a"],
      ["shared", "b"],
    ]);
  });

  it("leaves another site's accounts out of the set", () => {
    const tokens = [
      makeToken({ id: "ig", domain: "instagram.com", account: "alice", name: "sessionid" }),
      makeToken({ id: "fb", domain: "facebook.com", account: "alice", name: "sessionid" }),
    ];
    const sets = credentialSetsForUrl(tokens, "https://www.instagram.com/p/123");

    expect(sets).toHaveLength(1);
    expect(sets[0]?.tokens.map((t) => t.id)).toEqual(["ig"]);
  });

  it("orders the accounts the same way on every call, so rotation is the only thing that varies", () => {
    const tokens = [
      makeToken({ id: "c", domain: "instagram.com", account: "carol" }),
      makeToken({ id: "a", domain: "instagram.com", account: "alice" }),
      makeToken({ id: "b", domain: "instagram.com", account: "bob" }),
    ];

    expect(credentialSetsForUrl(tokens, "https://instagram.com").map((s) => s.account)).toEqual([
      "alice",
      "bob",
      "carol",
    ]);
  });
});

describe("rotateCredentialSet", () => {
  it("returns null when the site has no tokens", () => {
    expect(rotateCredentialSet([])).toBeNull();
  });

  it("returns the only set when there is one", () => {
    const only = { account: null, tokens: [] };

    expect(rotateCredentialSet([only])).toBe(only);
  });

  it("reaches every account over repeated imports", () => {
    const sets = [
      { account: "alice", tokens: [] },
      { account: "bob", tokens: [] },
      { account: "carol", tokens: [] },
    ];
    const seen = new Set<string | null>();

    for (let i = 0; i < 200; i++) {
      seen.add(rotateCredentialSet(sets)?.account ?? null);
    }

    expect([...seen].sort()).toEqual(["alice", "bob", "carol"]);
  });
});
