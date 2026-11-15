import { describe, expect, it } from "vitest";

const {
  getAuthTransportSnapshot,
  noteSignedOut,
  publishSignedIn,
  publishSignedOut,
  rekeysOnSettle,
  takeSessionLeft,
} = await import("@/lib/auth/auth-session-sync");

describe("rekeysOnSettle", () => {
  it("keeps the tree when the session settles on the account it already renders", () => {
    expect(rekeysOnSettle("reader-1", "reader-1")).toBe(false);
  });

  it("keeps the tree when it learns its first account", () => {
    expect(rekeysOnSettle(undefined, "reader-1")).toBe(false);
  });

  it("re-keys on a sign-in over a signed-out tree", () => {
    expect(rekeysOnSettle(null, "reader-1")).toBe(true);
  });

  it("re-keys on another account", () => {
    expect(rekeysOnSettle("reader-1", "reader-2")).toBe(true);
  });

  it("re-keys on a sign-out", () => {
    expect(rekeysOnSettle("reader-1", null)).toBe(true);
  });
});

describe("publishSignedIn", () => {
  it("re-keys only when the account the tree renders changes", () => {
    const start = getAuthTransportSnapshot().version;

    // A signed-in launch: the persisted account, then the server's answer for the same one.
    publishSignedIn("reader-1");
    publishSignedIn("reader-1");
    expect(getAuthTransportSnapshot()).toEqual({ hasActiveSession: true, version: start });

    publishSignedIn("reader-2");
    expect(getAuthTransportSnapshot().version).toBe(start + 1);

    // Sign-out re-keys through leave; signing back in re-keys again.
    publishSignedOut("https://a.example");
    noteSignedOut();
    publishSignedIn("reader-1");
    expect(getAuthTransportSnapshot()).toEqual({ hasActiveSession: true, version: start + 3 });
  });
});

describe("noteSignedOut", () => {
  it("keeps the signed-in tree when a failed read settles signed out, then on its account", () => {
    publishSignedIn("reader-1");
    const start = getAuthTransportSnapshot().version;

    // An Offline launch whose persisted read failed: no user, while the tree is signed in.
    noteSignedOut();
    publishSignedIn("reader-1");
    expect(getAuthTransportSnapshot()).toEqual({ hasActiveSession: true, version: start });
  });

  it("still re-keys when another account settles after it", () => {
    publishSignedIn("reader-1");
    const start = getAuthTransportSnapshot().version;

    noteSignedOut();
    publishSignedIn("reader-2");
    expect(getAuthTransportSnapshot().version).toBe(start + 1);
  });
});

describe("takeSessionLeft", () => {
  it("hands the left Server Address to one arrival, then nothing", () => {
    takeSessionLeft();
    publishSignedIn("reader-1");
    publishSignedOut("https://a.example");
    expect(takeSessionLeft()).toBe("https://a.example");
    expect(takeSessionLeft()).toBeNull();
  });

  it("is dropped by the next sign-in", () => {
    publishSignedOut("https://a.example");
    publishSignedIn("reader-1");
    expect(takeSessionLeft()).toBeNull();
  });
});
