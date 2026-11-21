import { resolveSessionView } from "@/lib/boot/session-view";
import { describe, expect, it } from "vitest";

describe("resolveSessionView", () => {
  it("leaves the ground bare while a pending session is covered by the launch splash", () => {
    expect(resolveSessionView(true, false, "covered")).toBe("bare");
  });

  it("shows the loader for a session pending after the launch, such as a sign-out in flight", () => {
    expect(resolveSessionView(true, false, "done")).toBe("loader");
    expect(resolveSessionView(true, false, "leaving")).toBe("loader");
  });

  it("shows the app once the session is settled", () => {
    expect(resolveSessionView(false, true, "done")).toBe("signed-in");
    expect(resolveSessionView(false, false, "covered")).toBe("signed-out");
  });

  it("keeps a signed-in session on screen while it is still pending", () => {
    expect(resolveSessionView(false, true, "covered")).toBe("signed-in");
  });
});
