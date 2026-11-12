import { leaveToLogin } from "@/app/providers/platform-provider";
import { afterEach, describe, expect, it, vi } from "vitest";

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
