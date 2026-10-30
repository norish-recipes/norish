import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import SettingsPageContent from "@/app/(app)/settings/components/settings-page-content";
import { openSettingsTab } from "@/app/(app)/settings/settings-tab";

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

const { navigation } = vi.hoisted(() => ({
  navigation: { searchParams: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => navigation.searchParams,
}));

// The tab contents are irrelevant to tab presence and drag in the whole
// data layer; the ticket explicitly allows the panels to stay lazy.
vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const shape = { showAdminTab: false, household: "none", caldav: "none" } as const;

describe("settings tab list", () => {
  it("shows the Admin tab in the first painted tab list for an administrator", () => {
    navigation.searchParams = new URLSearchParams();

    render(<SettingsPageContent shape={{ ...shape, showAdminTab: true }} />);

    expect(screen.getByRole("tab", { name: /tabs\.admin/ })).toBeInTheDocument();
  });

  it("never renders an Admin tab for a regular member", () => {
    navigation.searchParams = new URLSearchParams();

    render(<SettingsPageContent shape={shape} />);

    expect(screen.queryByRole("tab", { name: /tabs\.admin/ })).not.toBeInTheDocument();
    // User, Household, CalDAV and Ingredients.
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("lands an administrator directly on a deep-linked admin tab", () => {
    navigation.searchParams = new URLSearchParams("tab=admin");

    render(<SettingsPageContent shape={{ ...shape, showAdminTab: true }} />);

    expect(screen.getByRole("tab", { name: /tabs\.admin/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("falls back to the default tab when a member deep-links to admin", () => {
    navigation.searchParams = new URLSearchParams("tab=admin");

    render(<SettingsPageContent shape={shape} />);

    expect(screen.queryByRole("tab", { name: /tabs\.admin/ })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /tabs\.user/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});

describe("the tab an address opens", () => {
  it.each([
    ["caldav", false, "caldav"],
    ["admin", true, "admin"],
    ["admin", false, "user"],
    ["sideways", false, "user"],
    [null, false, "user"],
  ] as const)("?tab=%s with admin %s opens %s", (param, admin, open) => {
    expect(openSettingsTab(param, { ...shape, showAdminTab: admin })).toBe(open);
  });
});
