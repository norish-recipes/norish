import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import AdminSettingsLayout from "@/app/(app)/settings/admin/layout";
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

const { navigation, profile } = vi.hoisted(() => ({
  navigation: { pathname: "/settings/account" },
  profile: { identity: null as { isServerAdmin: boolean } | null },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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
}));

describe("the settings tab bar", () => {
  it("shows the Admin tab to an administrator", () => {
    render(<SettingsTabs showAdminTab />);

    expect(screen.getByRole("tab", { name: /tabs\.admin/ })).toBeInTheDocument();
  });

  it("never shows an Admin tab to a regular member", () => {
    render(<SettingsTabs showAdminTab={false} />);

    expect(screen.queryByRole("tab", { name: /tabs\.admin/ })).not.toBeInTheDocument();
    // Account, Household, CalDAV and Ingredients.
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("links each tab to its route and marks the one the address names", () => {
    navigation.pathname = "/settings/household";

    render(<SettingsTabs showAdminTab />);

    expect(screen.getByRole("tab", { name: /tabs\.account/ })).toHaveAttribute(
      "href",
      "/settings/account"
    );
    expect(screen.getByRole("tab", { name: /tabs\.household/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
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
