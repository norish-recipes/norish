import { describe, expect, it } from "vitest";

import { parseRedisUrl } from "../../src/redis/url";

describe("parseRedisUrl", () => {
  it("keeps the username, password and database index", () => {
    expect(parseRedisUrl("redis://user:pass@host:6379/2")).toEqual({
      host: "host",
      port: 6379,
      username: "user",
      password: "pass",
      db: 2,
    });
  });

  it("defaults the port and leaves optional parts out", () => {
    expect(parseRedisUrl("redis://localhost")).toEqual({ host: "localhost", port: 6379 });
  });

  it("accepts a password-only URL", () => {
    expect(parseRedisUrl("redis://:secret@redis:6380")).toEqual({
      host: "redis",
      port: 6380,
      password: "secret",
    });
  });

  it("turns rediss:// into a TLS connection", () => {
    expect(parseRedisUrl("rediss://host")).toEqual({ host: "host", port: 6379, tls: {} });
  });

  it("decodes percent-encoded credentials", () => {
    expect(parseRedisUrl("redis://us%40er:p%40ss@host")).toMatchObject({
      username: "us@er",
      password: "p@ss",
    });
  });

  it("rejects a database index that is not a whole number", () => {
    expect(() => parseRedisUrl("redis://host/two")).toThrow(/database index/);
  });

  it("rejects a scheme that is not redis or rediss", () => {
    expect(() => parseRedisUrl("http://host:6379")).toThrow(/scheme/);
  });
});
