import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPush = vi.hoisted(() => vi.fn());
const mockSetUserMenuOpen = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());

let mockUser = {
  id: "user-1",
  name: "User",
  email: "user@example.com",
  image: "/avatars/user-1.png",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/hooks/config", () => ({
  useVersionQuery: () => ({
    currentVersion: "1.0.0",
    latestVersion: null,
    updateAvailable: false,
    releaseUrl: null,
  }),
}));

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({
    user: mockUser,
    userMenuOpen: false,
    setUserMenuOpen: mockSetUserMenuOpen,
    signOut: mockSignOut,
  }),
}));

vi.mock("@heroui/avatar", () => ({
  Avatar: ({ src }: { src?: string }) => <img alt="user avatar" src={src} />,
}));

vi.mock("@heroui/dropdown", () => ({
  Dropdown: ({ children }: any) => <div>{children}</div>,
  DropdownTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownItem: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@heroui/react", () => ({
  Button: ({ children }: any) => <button type="button">{children}</button>,
}));

vi.mock("@/components/shared/import-recipe-modal", () => ({
  default: () => null,
}));

vi.mock("@/components/shared/language-switch", () => ({
  LanguageSwitch: () => null,
}));

vi.mock("@/components/navbar/theme-switch", () => ({
  ThemeSwitch: () => null,
}));

import NavbarUserMenu from "@/components/navbar/navbar-user-menu";

describe("NavbarUserMenu avatar src", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: "user-1",
      name: "User",
      email: "user@example.com",
      image: "/avatars/user-1.png",
    };
  });

  it("changes avatar src when user object updates with same image path", async () => {
    const { rerender } = render(<NavbarUserMenu />);

    const firstSrc = screen.getByAltText("user avatar").getAttribute("src");

    mockUser = {
      id: "user-1",
      name: "User Updated",
      email: "user@example.com",
      image: "/avatars/user-1.png",
    };

    rerender(<NavbarUserMenu />);

    await waitFor(() => {
      const secondSrc = screen.getByAltText("user avatar").getAttribute("src");

      expect(secondSrc).not.toBe(firstSrc);
    });
  });
});
