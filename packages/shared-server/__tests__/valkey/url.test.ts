import { describe, expect, it } from "vitest";

import { parseValkeyUrl } from "../../src/valkey/url";

describe("parseValkeyUrl", () => {
  it("keeps the username, password and database index", () => {
    expect(parseValkeyUrl("valkey://user:pass@host:6379/2")).toEqual({
      host: "host",
      port: 6379,
      username: "user",
      password: "pass",
      db: 2,
    });
  });

  it("defaults the port and leaves optional parts out", () => {
    expect(parseValkeyUrl("valkey://localhost")).toEqual({ host: "localhost", port: 6379 });
  });

  it("accepts a password-only URL", () => {
    expect(parseValkeyUrl("valkey://:secret@valkey:6380")).toEqual({
      host: "valkey",
      port: 6380,
      password: "secret",
    });
  });

  it("turns valkeys:// into a TLS connection", () => {
    expect(parseValkeyUrl("valkeys://host")).toEqual({ host: "host", port: 6379, tls: {} });
  });

  it("decodes percent-encoded credentials", () => {
    expect(parseValkeyUrl("valkey://us%40er:p%40ss@host")).toMatchObject({
      username: "us@er",
      password: "p@ss",
    });
  });

  it("rejects a database index that is not a whole number", () => {
    expect(() => parseValkeyUrl("valkey://host/two")).toThrow(/database index/);
  });

  it("rejects a scheme that is not valkey or valkeys, redis:// included", () => {
    expect(() => parseValkeyUrl("http://host:6379")).toThrow(/scheme/);
    expect(() => parseValkeyUrl("redis://host:6379")).toThrow(/use valkey:\/\/ or valkeys:\/\//);
  });
});
