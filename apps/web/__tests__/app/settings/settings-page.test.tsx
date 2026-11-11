import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import AdminSettingsLayout from "@/app/(app)/settings/admin/layout";
import SettingsLayout from "@/app/(app)/settings/layout";
import SettingsPage from "@/app/(app)/settings/page";
import { SettingsTabs } from "@/components/settings/settings-tabs";

beforeAll(() => {
  // HeroUI's Tabs list measures its overflow; jsdom has no ResizeObserver.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

const { navigation, profile, push } = vi.hoisted(() => ({
  push: vi.fn(),
  navigation: { pathname: "/settings/account" },
  profile: { identity: null as { isServerAdmin: boolean } | null },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => navigation.pathname,
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

vi.mock("@/lib/request-profile", () => ({
  readRequestProfile: async () => profile,
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  NextIntlClientProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("next-intl/server", () => ({
  getMessages: async () => ({}),
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

describe("the settings tab bar", () => {
  it("shows the Admin tab to an administrator", () => {
    render(<SettingsTabs showAdminTab>content</SettingsTabs>);

    expect(screen.getByRole("tab", { name: /tabs\.admin/ })).toBeInTheDocument();
  });

  it("never shows an Admin tab to a regular member", () => {
    render(<SettingsTabs showAdminTab={false}>content</SettingsTabs>);

    expect(screen.queryByRole("tab", { name: /tabs\.admin/ })).not.toBeInTheDocument();
    // Account, Household, CalDAV and Ingredients.
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("links each tab to its route and marks the one the address names", () => {
    navigation.pathname = "/settings/household";

    render(<SettingsTabs showAdminTab>content</SettingsTabs>);

    expect(screen.getByRole("tab", { name: /tabs\.account/ })).toHaveAttribute(
      "href",
      "/settings/account"
    );
    expect(screen.getByRole("tab", { name: /tabs\.household/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("draws the open tab's content in the panel the tab controls", () => {
    navigation.pathname = "/settings/caldav";

    render(<SettingsTabs showAdminTab>caldav content</SettingsTabs>);

    const panel = screen.getByRole("tabpanel");

    expect(panel).toHaveTextContent("caldav content");
    expect(screen.getByRole("tab", { name: /tabs\.caldav/ })).toHaveAttribute(
      "aria-controls",
      panel.id
    );
  });

  it("stays put when the open tab is clicked again", () => {
    navigation.pathname = "/settings/household";
    push.mockClear();

    render(<SettingsTabs showAdminTab>content</SettingsTabs>);
    fireEvent.click(screen.getByRole("tab", { name: /tabs\.household/ }));

    expect(push).not.toHaveBeenCalled();
  });

  it("goes to another tab's address when it is clicked", () => {
    navigation.pathname = "/settings/household";
    push.mockClear();

    render(<SettingsTabs showAdminTab>content</SettingsTabs>);
    fireEvent.click(screen.getByRole("tab", { name: /tabs\.caldav/ }));

    expect(push).toHaveBeenCalledWith("/settings/caldav", undefined);
  });
});

describe("the settings layout", () => {
  it("gives an administrator the Admin tab", async () => {
    navigation.pathname = "/settings/account";
    profile.identity = { isServerAdmin: true };

    render(await SettingsLayout({ children: "content" }));

    expect(screen.getByRole("tab", { name: /tabs\.admin/ })).toBeInTheDocument();
  });

  it("gives a regular member no Admin tab", async () => {
    navigation.pathname = "/settings/account";
    profile.identity = { isServerAdmin: false };

    render(await SettingsLayout({ children: "content" }));

    expect(screen.queryByRole("tab", { name: /tabs\.admin/ })).not.toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("content");
  });
});

describe("the settings redirects", () => {
  it("sends /settings to the account tab", () => {
    expect(() => SettingsPage()).toThrow("redirect:/settings/account");
  });

  it("sends a non-admin away from the admin tab", async () => {
    profile.identity = { isServerAdmin: false };

    await expect(AdminSettingsLayout({ children: "admin" })).rejects.toThrow(
      "redirect:/settings/account"
    );
  });

  it("lets an administrator into the admin tab", async () => {
    profile.identity = { isServerAdmin: true };

    await expect(AdminSettingsLayout({ children: "admin" })).resolves.toBe("admin");
  });
});
