import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import MobileNav from "@/components/navbar/mobile-nav";
import { Navbar } from "@/components/navbar/navbar";

const provider = vi.hoisted(() => ({ isBring: false, pathname: "/calendar" }));

vi.mock("next/navigation", () => ({ usePathname: () => provider.pathname }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@norish/shared-react/config", () => ({
  useGroceryListProvider: () => ({
    provider: provider.isBring ? "bring" : "builtin",
    isBring: provider.isBring,
    isLoading: false,
  }),
}));
vi.mock("@/components/brand/brand-logo", () => ({ BrandLogo: () => null }));
vi.mock("@/components/navbar/navbar-user-menu", () => ({ default: () => null }));
vi.mock("@/hooks/auto-hide", () => ({
  useAutoHide: () => ({
    isVisible: true,
    show: vi.fn(),
    onHoverStart: vi.fn(),
    onHoverEnd: vi.fn(),
  }),
}));

describe("the navbar", () => {
  beforeEach(() => {
    provider.isBring = false;
    provider.pathname = "/calendar";
  });

  it("shows Home, Groceries and Calendar on the desktop bar while the list is built in", () => {
    render(<Navbar />);

    const bar = within(screen.getByLabelText("Main navigation"));

    expect(bar.getAllByRole("link", { name: /^(home|groceries|calendar)$/ })).toHaveLength(3);
    expect(bar.getByRole("link", { name: "groceries" })).toHaveAttribute("href", "/groceries");
  });

  it("leaves Groceries off the desktop bar when Bring! is the list", () => {
    provider.isBring = true;
    render(<Navbar />);

    const bar = within(screen.getByLabelText("Main navigation"));

    expect(bar.queryByRole("link", { name: "groceries" })).toBeNull();
    expect(bar.getByRole("link", { name: "calendar" })).toHaveClass("text-accent");
  });
});

describe("the phone's navbar", () => {
  const tabList = () => screen.getByRole("list");

  beforeEach(() => {
    provider.isBring = false;
    provider.pathname = "/calendar";
  });

  it("has four columns with Groceries, and the pill under Calendar's third", () => {
    render(<MobileNav />);

    expect(within(tabList()).getAllByRole("link")).toHaveLength(4);
    expect(tabList().style.gridTemplateColumns).toMatch(/^repeat\(4, /);
    expect(tabList().previousElementSibling).toHaveStyle({ width: "25%", translate: "200% 0" });
  });

  it("has three columns without Groceries, and the pill follows the remaining order", () => {
    provider.isBring = true;
    render(<MobileNav />);

    expect(within(tabList()).queryByRole("link", { name: "groceries" })).toBeNull();
    expect(within(tabList()).getAllByRole("link")).toHaveLength(3);
    expect(tabList().style.gridTemplateColumns).toMatch(/^repeat\(3, /);
    // Calendar is the second of three now.
    expect((tabList().previousElementSibling as HTMLElement).style.translate).toMatch(/^100%/);
  });
});
