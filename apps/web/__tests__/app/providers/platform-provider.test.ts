import { createElement } from "react";
import {
  endWebSession,
  leaveToLogin,
  WebPlatformProvider,
} from "@/app/providers/platform-provider";
import { toast } from "@heroui/react";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePlatform } from "@norish/shared-react/platform";

const signOut = vi.hoisted(() => vi.fn(async () => ({ error: null })));

vi.mock("@norish/shared/lib/auth/client", () => ({ signOut }));
vi.mock("@heroui/react", () => ({ toast: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

describe("the web's endSession", () => {
  it("ends the session on the server everywhere", async () => {
    await endWebSession("everywhere");

    expect(signOut).toHaveBeenCalledOnce();
  });

  it("leaves the server's session alone on this device only", async () => {
    signOut.mockClear();

    await endWebSession("device");

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

describe("the web's toast", () => {
  const show = (severity: "warning" | "default") => {
    const { result } = renderHook(() => usePlatform(), {
      wrapper: ({ children }) => createElement(WebPlatformProvider, null, children),
    });

    result.current.toast.show({ severity, title: "Title", description: "Description" });
  };

  it("turns a warning severity into the HeroUI warning variant", () => {
    show("warning");

    expect(toast).toHaveBeenLastCalledWith("Title", {
      description: "Description",
      variant: "warning",
    });
  });

  it("turns the default severity into the HeroUI default variant", () => {
    show("default");

    expect(toast).toHaveBeenLastCalledWith("Title", {
      description: "Description",
      variant: "default",
    });
  });
});
