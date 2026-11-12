import { describe, expect, it } from "vitest";

const { publishSignedIn, publishSignedOut, takeSessionLeft } =
  await import("@/lib/auth/auth-session-sync");

describe("takeSessionLeft", () => {
  it("hands the left Server Address to one arrival, then nothing", () => {
    expect(takeSessionLeft()).toBeNull();

    publishSignedIn();
    publishSignedOut("https://a.example");
    expect(takeSessionLeft()).toBe("https://a.example");
    expect(takeSessionLeft()).toBeNull();
  });

  it("is dropped by the next sign-in", () => {
    publishSignedOut("https://a.example");
    publishSignedIn();
    expect(takeSessionLeft()).toBeNull();
  });
});
