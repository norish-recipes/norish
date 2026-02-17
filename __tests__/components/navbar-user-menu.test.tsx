import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  it("uses plain avatar URL without cache-busting query params", () => {
    render(<NavbarUserMenu />);

    const src = screen.getByAltText("user avatar").getAttribute("src");

    expect(src).toBe("/avatars/user-1.png");
>>>>>>> rc/v0.16.2
    vi.clearAllMocks();
    mockUser = {
      id: "user-1",
      name: "User",
      email: "user@example.com",
      image: "/avatars/user-1.png",
    };
  });

<<<<<<< HEAD
  it("refreshes avatar src only when the path changes, not on just name change", async () => {
    const { rerender } = render(<NavbarUserMenu />);
=======
  it("uses plain avatar URL without cache-busting query params", () => {
    render(<NavbarUserMenu />);
>>>>>>> rc/v0.16.2

    const src = screen.getByAltText("user avatar").getAttribute("src");

<<<<<<< HEAD
    mockUser = {
      id: "user-1",
      name: "User Updated",
      email: "user@example.com",
      image: "/avatars/user-1.png",
    };

    rerender(<NavbarUserMenu />);

    await waitFor(() => {
      const secondSrc = screen.getByAltText("user avatar").getAttribute("src");

      expect(secondSrc).toBe(firstSrc);
    });
  });

  it("changes avatar src when image path changes", async () => {
    const { rerender } = render(<NavbarUserMenu />);

    const firstSrc = screen.getByAltText("user avatar").getAttribute("src");

    mockUser = {
      id: "user-1",
      name: "User",
      email: "user@example.com",
      image: "/avatars/user-1-updated.png",
    };

    rerender(<NavbarUserMenu />);

    await waitFor(() => {
      const secondSrc = screen.getByAltText("user avatar").getAttribute("src");

      expect(secondSrc).not.toBe(firstSrc);
    });
=======
    expect(src).toBe("/avatars/user-1.png");
>>>>>>> rc/v0.16.2
  });
});
