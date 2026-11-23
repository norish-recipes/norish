import { shareSubtitle } from "@/lib/share-subtitle";
import { describe, expect, it } from "vitest";

const t = (id: string, values?: Record<string, string>) =>
  `${id}${values ? ` ${values.date}` : ""}`;
const format = (date: Date) => date.toISOString().slice(5, 10);

describe("shareSubtitle", () => {
  it("names the end and the last open of an active link", () => {
    expect(
      shareSubtitle(
        {
          status: "active",
          expiresAt: new Date("2026-11-12"),
          lastAccessedAt: new Date("2026-11-06"),
        },
        t,
        format
      )
    ).toBe("expiresOn 11-12 · lastOpenedOn 11-06");
  });

  it("says a link that never ends so, and an expired one when it ended", () => {
    expect(
      shareSubtitle({ status: "active", expiresAt: null, lastAccessedAt: null }, t, format)
    ).toBe("neverExpires");
    expect(
      shareSubtitle(
        { status: "expired", expiresAt: new Date("2026-10-30"), lastAccessedAt: null },
        t,
        format
      )
    ).toBe("expiredOn 10-30");
  });

  it("leaves the end out for a paused link", () => {
    expect(
      shareSubtitle(
        { status: "revoked", expiresAt: null, lastAccessedAt: new Date("2026-11-06") },
        t,
        format
      )
    ).toBe("lastOpenedOn 11-06");
  });
});
