import { fadesInAfterSessionEnd, resolveSignedOutEntry } from "@/lib/boot/signed-out-entry";
import { describe, expect, it } from "vitest";

describe("resolveSignedOutEntry", () => {
  it("opens on Server address with no Server Address saved", () => {
    expect(resolveSignedOutEntry("", false)).toBe("server-address");
  });

  it("opens on Sign in once a Server Address is saved", () => {
    expect(resolveSignedOutEntry("https://norish.example", false)).toBe("sign-in");
  });

  it("opens on Server address when the reader asked to change the saved one", () => {
    expect(resolveSignedOutEntry("https://norish.example", true)).toBe("server-address");
  });
});

describe("fadesInAfterSessionEnd", () => {
  const address = "https://norish.example";

  it("fades in the screen a session end lands on, for the Server Address it left", () => {
    expect(fadesInAfterSessionEnd(address, address)).toBe(true);
  });

  it("cuts on a launch, or a Server Address change made while signed out", () => {
    expect(fadesInAfterSessionEnd(null, address)).toBe(false);
  });

  it("cuts once the Server Address changed since the session ended", () => {
    expect(fadesInAfterSessionEnd(address, "https://other.example")).toBe(false);
  });
});
