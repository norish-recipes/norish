import { createElement } from "react";
import {
  endWebSession,
  leaveToLogin,
  WebPlatformProvider,
} from "@/app/providers/platform-provider";
import { showActionToast } from "@/lib/ui/action-toast";
import { toast } from "@heroui/react";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePlatform } from "@norish/shared-react/platform";

const signOut = vi.hoisted(() => vi.fn(async () => ({ error: null })));
const push = vi.hoisted(() => vi.fn());

vi.mock("@norish/shared/lib/auth/client", () => ({ signOut }));
vi.mock("@heroui/react", () => ({ toast: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/ui/action-toast", () => ({ showActionToast: vi.fn() }));
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

const renderPlatform = () =>
  renderHook(() => usePlatform(), {
    wrapper: ({ children }) => createElement(WebPlatformProvider, null, children),
  }).result.current;

describe("the web's toast", () => {
  const show = (severity: "warning" | "default") =>
    renderPlatform().toast.show({ severity, title: "Title", description: "Description" });

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

  it("puts an action on the title's line, closing on press", () => {
    const onActionPress = vi.fn();

    renderPlatform().toast.show({
      severity: "default",
      title: "Title",
      actionLabel: "Open",
      onActionPress,
    });

    expect(showActionToast).toHaveBeenLastCalledWith("Title", {
      description: undefined,
      variant: "default",
      action: { label: "Open", onPress: expect.any(Function) },
    });
    vi.mocked(showActionToast).mock.lastCall![1].action.onPress();
    expect(onActionPress).toHaveBeenCalledOnce();
  });
});

describe("a persistent toast", () => {
  it("keeps an action toast open until it is dismissed or its action is pressed", () => {
    renderPlatform().toast.show({
      severity: "success",
      title: "Ready",
      actionLabel: "Open",
      onActionPress: vi.fn(),
      persistent: true,
    });

    expect(showActionToast).toHaveBeenLastCalledWith(
      "Ready",
      expect.objectContaining({ timeout: 0 })
    );
  });

  it("keeps a plain toast open too", () => {
    renderPlatform().toast.show({ severity: "warning", title: "Heads up", persistent: true });

    expect(toast).toHaveBeenLastCalledWith("Heads up", expect.objectContaining({ timeout: 0 }));
  });

  it("leaves the timeout to the toast's own default otherwise", () => {
    renderPlatform().toast.show({ severity: "default", title: "Done", actionLabel: "Undo" });

    expect(vi.mocked(showActionToast).mock.lastCall![1].timeout).toBeUndefined();
  });
});

describe("the web's external links", () => {
  it("opens one in a new tab that cannot reach back to the app, and says it did", () => {
    const tab = { opener: {} as unknown };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);

    expect(renderPlatform().openExternalUrl("https://getbring.onelink.me/abc")).toBe(true);

    expect(open).toHaveBeenCalledExactlyOnceWith("https://getbring.onelink.me/abc", "_blank");
    expect(tab.opener).toBeNull();
    open.mockRestore();
  });

  it("says so when the browser blocked the tab", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    expect(renderPlatform().openExternalUrl("https://getbring.onelink.me/abc")).toBe(false);
    open.mockRestore();
  });

  it("opens http as well, and nothing that is not http or https", () => {
    const open = vi.spyOn(window, "open").mockReturnValue({ opener: null } as unknown as Window);
    const { openExternalUrl } = renderPlatform();

    expect(openExternalUrl("http://localhost:4010/open")).toBe(true);
    expect(openExternalUrl("javascript:alert(1)")).toBe(false);
    expect(openExternalUrl("data:text/html,hi")).toBe(false);
    expect(openExternalUrl("not a url")).toBe(false);

    expect(open).toHaveBeenCalledExactlyOnceWith("http://localhost:4010/open", "_blank");
    open.mockRestore();
  });

  describe("in an iPhone's Home Screen app", () => {
    const originalLocation = window.location;
    const homeScreenApp = (standalone: boolean) =>
      Object.defineProperty(navigator, "standalone", { configurable: true, value: standalone });

    afterEach(() => {
      Reflect.deleteProperty(navigator, "standalone");
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    });

    it("goes to the link from the page itself, which iOS hands to the app, and opens no window", () => {
      const assign = vi.fn();
      const open = vi.spyOn(window, "open");

      homeScreenApp(true);
      Object.defineProperty(window, "location", { configurable: true, value: { assign } });

      expect(renderPlatform().openExternalUrl("https://getbring.onelink.me/abc")).toBe(true);

      expect(assign).toHaveBeenCalledExactlyOnceWith("https://getbring.onelink.me/abc");
      expect(open).not.toHaveBeenCalled();
      open.mockRestore();
    });

    it("still goes nowhere that is not http or https", () => {
      const assign = vi.fn();

      homeScreenApp(true);
      Object.defineProperty(window, "location", { configurable: true, value: { assign } });

      expect(renderPlatform().openExternalUrl("javascript:alert(1)")).toBe(false);
      expect(assign).not.toHaveBeenCalled();
    });

    it("opens a tab as usual where Safari says it is not a Home Screen app", () => {
      const open = vi.spyOn(window, "open").mockReturnValue({ opener: null } as unknown as Window);

      homeScreenApp(false);

      expect(renderPlatform().openExternalUrl("https://getbring.onelink.me/abc")).toBe(true);
      expect(open).toHaveBeenCalledOnce();
      open.mockRestore();
    });
  });

  it("follows the instance's shopping list provider setting", () => {
    expect(renderPlatform().supportsExternalShoppingList).toBe(true);
  });
});

describe("the web's navigation", () => {
  it("goes home to the Library and to a recipe by its page", () => {
    const { navigation } = renderPlatform();

    navigation.toHome();
    navigation.toRecipe("recipe-held");

    expect(push.mock.calls).toEqual([["/"], ["/recipes/recipe-held"]]);
  });
});
