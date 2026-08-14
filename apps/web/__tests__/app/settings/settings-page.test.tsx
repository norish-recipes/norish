import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import SettingsPageContent from "@/app/(app)/settings/components/settings-page-content";

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

describe("settings tab list", () => {
  it("shows the Admin tab in the first painted tab list for an administrator", () => {
    navigation.searchParams = new URLSearchParams();

    render(<SettingsPageContent showAdminTab />);

    expect(screen.getByRole("tab", { name: /tabs\.admin/ })).toBeInTheDocument();
  });

  it("never renders an Admin tab for a regular member", () => {
    navigation.searchParams = new URLSearchParams();

    render(<SettingsPageContent showAdminTab={false} />);

    expect(screen.queryByRole("tab", { name: /tabs\.admin/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("lands an administrator directly on a deep-linked admin tab", () => {
    navigation.searchParams = new URLSearchParams("tab=admin");

    render(<SettingsPageContent showAdminTab />);

    expect(screen.getByRole("tab", { name: /tabs\.admin/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("falls back to the default tab when a member deep-links to admin", () => {
    navigation.searchParams = new URLSearchParams("tab=admin");

    render(<SettingsPageContent showAdminTab={false} />);

    expect(screen.queryByRole("tab", { name: /tabs\.admin/ })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /tabs\.user/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
