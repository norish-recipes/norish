import { endWebSession, leaveToLogin } from "@/app/providers/platform-provider";
import { afterEach, describe, expect, it, vi } from "vitest";

const signOut = vi.hoisted(() => vi.fn(async () => ({ error: null })));

vi.mock("@norish/shared/lib/auth/client", () => ({ signOut }));

describe("the web's endSession", () => {
  it("ends the session on the server on a sign-out", async () => {
    await endWebSession("sign-out");

    expect(signOut).toHaveBeenCalledOnce();
  });

  it("leaves the server's session alone on expiry", async () => {
    signOut.mockClear();

    await endWebSession("expiry");

    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("the web's leave", () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("navigates once per page: a later expiry cannot replace a sign-out's destination", () => {
    const assign = vi.fn();

    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "http://norish.test", pathname: "/groceries", search: "", assign },
    });

    leaveToLogin("sign-out");
    leaveToLogin("expiry");

    expect(assign).toHaveBeenCalledExactlyOnceWith("http://norish.test/login?logout=true");
  });
});
