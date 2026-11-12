import { describe, expect, it } from "vitest";

const { getAuthTransportSnapshot, publishSignedIn, publishSignedOut } =
  await import("@/lib/auth/auth-session-sync");

describe("leftSession", () => {
  it("is set by a session ending and cleared by the next sign-in", () => {
    expect(getAuthTransportSnapshot().leftSession).toBe(false);

    publishSignedIn();
    expect(getAuthTransportSnapshot().leftSession).toBe(false);

    publishSignedOut();
    expect(getAuthTransportSnapshot()).toMatchObject({
      hasActiveSession: false,
      leftSession: true,
    });

    publishSignedIn();
    expect(getAuthTransportSnapshot()).toMatchObject({
      hasActiveSession: true,
      leftSession: false,
    });
  });
});
