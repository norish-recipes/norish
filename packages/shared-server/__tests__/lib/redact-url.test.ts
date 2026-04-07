import { describe, expect, it } from "vitest";

import { redactUrl } from "../../src/logger";

describe("redactUrl", () => {
  it("redacts password from a PostgreSQL connection string", () => {
    const url = "postgres://norish:supersecret@localhost/norish";
    expect(redactUrl(url)).toBe("postgres://norish:***@localhost/norish");
  });

  it("redacts password from a Redis connection string with password-only auth", () => {
    const url = "redis://:mypassword@localhost:6379/10";
    expect(redactUrl(url)).toBe("redis://:***@localhost:6379/10");
  });

  it("redacts password from a Redis connection string with user and password", () => {
    const url = "redis://user:pass@redis.example.com:6379";
    expect(redactUrl(url)).toBe("redis://user:***@redis.example.com:6379");
  });

  it("leaves a URL without credentials unchanged", () => {
    const url = "redis://localhost:6379";
    expect(redactUrl(url)).toBe("redis://localhost:6379");
  });

  it("leaves a URL with only a username (no password) unchanged", () => {
    const url = "postgres://norish@localhost/norish";
    expect(redactUrl(url)).toBe("postgres://norish@localhost/norish");
  });

  it("handles complex passwords with special characters", () => {
    const url = "postgres://user:p%40ss%3Aw0rd@db.host:5432/mydb";
    const result = redactUrl(url);
    expect(result).toContain("***");
    expect(result).not.toContain("p%40ss");
  });

  it("falls back to regex redaction on malformed URLs", () => {
    const malformed = "not-a-scheme://user:secret@host/db";
    const result = redactUrl(malformed);
    expect(result).not.toContain("secret");
  });
});
