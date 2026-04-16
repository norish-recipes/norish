import { describe, expect, it } from "vitest";

import { parseChannelMetadata } from "../../src/redis/channel-metadata";

describe("parseChannelMetadata", () => {
  describe("broadcast channels", () => {
    it("parses a broadcast channel", () => {
      const result = parseChannelMetadata("norish:recipes:broadcast:created");

      expect(result).toEqual({
        namespace: "recipes",
        scope: "broadcast",
        eventName: "created",
      });
    });

    it("handles multi-word event names", () => {
      const result = parseChannelMetadata("norish:recipes:broadcast:importStarted");

      expect(result).toEqual({
        namespace: "recipes",
        scope: "broadcast",
        eventName: "importStarted",
      });
    });
  });

  describe("household channels", () => {
    it("parses a household channel", () => {
      const result = parseChannelMetadata("norish:recipes:household:hh-123:imported");

      expect(result).toEqual({
        namespace: "recipes",
        scope: "household",
        eventName: "imported",
      });
    });

    it("ignores the scope identifier in the parsed result", () => {
      const result = parseChannelMetadata("norish:groceries:household:abc:created");

      expect(result?.namespace).toBe("groceries");
      expect(result?.eventName).toBe("created");
    });
  });

  describe("user channels", () => {
    it("parses a user channel", () => {
      const result = parseChannelMetadata("norish:recipes:user:usr-456:updated");

      expect(result).toEqual({
        namespace: "recipes",
        scope: "user",
        eventName: "updated",
      });
    });

    it("preserves the scope", () => {
      const result = parseChannelMetadata("norish:caldav:user:u1:syncStarted");

      expect(result?.scope).toBe("user");
    });
  });

  describe("global channels", () => {
    it("parses a global channel", () => {
      const result = parseChannelMetadata("norish:recipes:global:created");

      expect(result).toEqual({
        namespace: "recipes",
        scope: "global",
        eventName: "created",
      });
    });
  });

  describe("invalid channels", () => {
    it("returns null for non-norish channels", () => {
      expect(parseChannelMetadata("other:recipes:broadcast:created")).toBeNull();
    });

    it("returns null for channels with too few parts", () => {
      expect(parseChannelMetadata("norish:recipes")).toBeNull();
      expect(parseChannelMetadata("norish")).toBeNull();
    });

    it("returns null for channels with invalid scope", () => {
      expect(parseChannelMetadata("norish:recipes:invalid:created")).toBeNull();
    });

    it("returns null for household channels missing identifier", () => {
      expect(parseChannelMetadata("norish:recipes:household:only")).toBeNull();
    });

    it("returns null for user channels missing identifier", () => {
      expect(parseChannelMetadata("norish:recipes:user:only")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseChannelMetadata("")).toBeNull();
    });
  });

  describe("all four scopes", () => {
    const cases: Array<{
      channel: string;
      expected: { scope: string; eventName: string };
    }> = [
      {
        channel: "norish:recipes:broadcast:created",
        expected: { scope: "broadcast", eventName: "created" },
      },
      {
        channel: "norish:recipes:household:hh1:imported",
        expected: { scope: "household", eventName: "imported" },
      },
      {
        channel: "norish:recipes:user:u1:updated",
        expected: { scope: "user", eventName: "updated" },
      },
      {
        channel: "norish:recipes:global:deleted",
        expected: { scope: "global", eventName: "deleted" },
      },
    ];

    it.each(cases)("parses $channel correctly", ({ channel, expected }) => {
      const result = parseChannelMetadata(channel);

      expect(result?.scope).toBe(expected.scope);
      expect(result?.eventName).toBe(expected.eventName);
      expect(result?.namespace).toBe("recipes");
    });
  });
});
