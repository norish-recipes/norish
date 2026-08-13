import { defineDevicePreference } from "@/lib/device-preferences";
import { beforeEach, describe, expect, it } from "vitest";

const preference = defineDevicePreference({
  cookieName: "norish_test_preference",
  values: ["alpha", "beta"] as const,
  defaultValue: "alpha",
});

function clearCookie(name: string) {
  document.cookie = `${name}=;path=/;max-age=0`;
}

beforeEach(() => {
  clearCookie(preference.cookieName);
});

describe("defineDevicePreference", () => {
  describe("parse", () => {
    it("passes a recognised value through", () => {
      expect(preference.parse("beta")).toBe("beta");
    });

    it("lands an unrecognised value on the default", () => {
      expect(preference.parse("gamma")).toBe("alpha");
    });

    it("lands an absent value on the default", () => {
      expect(preference.parse(undefined)).toBe("alpha");
    });
  });

  describe("readFrom", () => {
    it("reads the stored value out of a request's cookies", () => {
      const cookieStore = { get: () => ({ value: "beta" }) };

      expect(preference.readFrom(cookieStore)).toBe("beta");
    });

    it("lands an absent request cookie on the default", () => {
      const cookieStore = { get: () => undefined };

      expect(preference.readFrom(cookieStore)).toBe("alpha");
    });
  });

  describe("cookie round trip", () => {
    it("reads back what it wrote", () => {
      preference.writeCookie("beta");

      expect(preference.readCookie()).toBe("beta");
    });

    it("reads null when this browser has never chosen", () => {
      expect(preference.readCookie()).toBeNull();
    });

    it("reads a tampered stored value as the default, not as null", () => {
      // A present-but-invalid cookie is a made choice with a broken value:
      // it parses to the default rather than counting as never-chosen.
      document.cookie = `${preference.cookieName}=gamma;path=/`;

      expect(preference.readCookie()).toBe("alpha");
    });
  });
});
