import { describe, expect, it } from "vitest";

import { buildChannel, parseChannel, streamKeyFor } from "../../src/realtime/channel";

describe("buildChannel", () => {
  it("pins the string for every scope", () => {
    expect(
      buildChannel({ namespace: "grocery", scope: "household", id: "hh-1", event: "created" })
    ).toBe("norish:grocery:household:hh-1:created");
    expect(
      buildChannel({ namespace: "caldav", scope: "user", id: "u-1", event: "syncStarted" })
    ).toBe("norish:caldav:user:u-1:syncStarted");
    expect(buildChannel({ namespace: "recipe", scope: "broadcast", event: "imported" })).toBe(
      "norish:recipe:broadcast:imported"
    );
    expect(
      buildChannel({
        namespace: "recipe-enrichment",
        scope: "internal",
        event: "recipeBecameUsable",
      })
    ).toBe("norish:recipe-enrichment:internal:recipeBecameUsable");
  });

  it("refuses a household or user channel without an id", () => {
    expect(() =>
      buildChannel({ namespace: "grocery", scope: "household", event: "created" })
    ).toThrow(/needs an id/);
    expect(() => buildChannel({ namespace: "grocery", scope: "user", event: "created" })).toThrow(
      /needs an id/
    );
  });
});

describe("parseChannel", () => {
  it("round-trips every scope", () => {
    const cases = [
      { namespace: "grocery", scope: "household" as const, id: "hh-1", event: "created" },
      { namespace: "caldav", scope: "user" as const, id: "u-1", event: "syncStarted" },
      { namespace: "recipe", scope: "broadcast" as const, event: "imported" },
      { namespace: "connection", scope: "internal" as const, event: "invalidate" },
    ];

    for (const parts of cases) {
      expect(parseChannel(buildChannel(parts))).toEqual(parts);
    }
  });

  it("keeps a colon inside the event name", () => {
    expect(parseChannel("norish:recipe:broadcast:import:started")).toEqual({
      namespace: "recipe",
      scope: "broadcast",
      event: "import:started",
    });
  });

  it("rejects the retired global scope", () => {
    expect(parseChannel("norish:recipe:global:created")).toBeNull();
  });

  it("rejects a non-norish prefix", () => {
    expect(parseChannel("other:recipe:broadcast:created")).toBeNull();
    expect(parseChannel("norishx:recipe:broadcast:created")).toBeNull();
  });

  it("rejects malformed channels", () => {
    expect(parseChannel("")).toBeNull();
    expect(parseChannel("norish")).toBeNull();
    expect(parseChannel("norish:recipe")).toBeNull();
    expect(parseChannel("norish:recipe:household:only")).toBeNull();
    expect(parseChannel("norish:recipe:user:only")).toBeNull();
    expect(parseChannel("norish:recipe:nowhere:created")).toBeNull();
    expect(parseChannel("norish::broadcast:created")).toBeNull();
  });
});

describe("streamKeyFor", () => {
  it("replaces the norish prefix with the stream prefix", () => {
    expect(streamKeyFor("norish:grocery:household:hh-1:created")).toBe(
      "norish:stream:grocery:household:hh-1:created"
    );
  });

  it("refuses a channel that is not a norish channel", () => {
    expect(() => streamKeyFor("other:grocery:household:hh-1:created")).toThrow(/Not a Norish/);
  });
});
