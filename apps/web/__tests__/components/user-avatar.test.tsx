import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "@testing-library/jest-dom";

import UserAvatar, { getUserInitials } from "@/components/shared/user-avatar";

describe("UserAvatar", () => {
  it("renders initials underneath the image while it loads", () => {
    render(<UserAvatar image="/avatars/user-1-100.png" name="Alice Smith" userId="user-1" />);

    const avatar = screen.getByRole("img", { name: "Alice Smith" });

    // Both layers present: the image on top, initials underneath
    expect(avatar.querySelector("img")).toHaveAttribute("src", "/avatars/user-1-100.png");
    expect(avatar).toHaveTextContent("AS");
  });

  it("keeps showing initials when the image 404s", () => {
    render(<UserAvatar image="/avatars/old-url.png" name="Alice Smith" userId="user-1" />);

    const avatar = screen.getByRole("img", { name: "Alice Smith" });

    fireEvent.error(avatar.querySelector("img")!);

    expect(avatar.querySelector("img")).toBeNull();
    expect(avatar).toHaveTextContent("AS");
  });

  it("retries with a fresh URL after a previous one failed", () => {
    const { rerender } = render(
      <UserAvatar image="/avatars/user-1-100.png" name="Alice" userId="user-1" />
    );

    const avatar = screen.getByRole("img", { name: "Alice" });

    fireEvent.error(avatar.querySelector("img")!);
    expect(avatar.querySelector("img")).toBeNull();

    rerender(<UserAvatar image="/avatars/user-1-200.png" name="Alice" userId="user-1" />);

    expect(avatar.querySelector("img")).toHaveAttribute("src", "/avatars/user-1-200.png");
  });

  it("renders initials with the pastel fallback style when there is no image", () => {
    render(<UserAvatar name="Bob Jones" userId="user-2" />);

    const avatar = screen.getByRole("img", { name: "Bob Jones" });

    expect(avatar.querySelector("img")).toBeNull();
    expect(avatar).toHaveTextContent("BJ");
    expect(avatar.style.backgroundColor).not.toBe("");
  });

  it("is a circle at every size", () => {
    for (const size of ["xs", "sm", "md", "lg"] as const) {
      const { unmount } = render(<UserAvatar name="Circle Check" size={size} userId="u" />);
      const avatar = screen.getByRole("img", { name: "Circle Check" });

      expect(avatar.className).toContain("rounded-full");
      unmount();
    }
  });

  it("maps the fixed size scale to the expected dimensions", () => {
    const expected = { xs: "size-8", sm: "size-11", md: "size-13", lg: "size-24" } as const;

    for (const [size, cls] of Object.entries(expected)) {
      const { unmount } = render(
        <UserAvatar name="Size Check" size={size as keyof typeof expected} userId="u" />
      );

      expect(screen.getByRole("img", { name: "Size Check" }).className).toContain(cls);
      unmount();
    }
  });

  it("accepts external OAuth image URLs", () => {
    render(<UserAvatar image="https://lh3.example.com/photo.jpg" name="Cara" userId="u3" />);

    const avatar = screen.getByRole("img", { name: "Cara" });

    expect(avatar.querySelector("img")).toHaveAttribute("src", "https://lh3.example.com/photo.jpg");
  });

  it("uses the plain avatar URL without cache-busting query params", () => {
    render(<UserAvatar image="/avatars/user-1-100.png" name="Alice" userId="user-1" />);

    const src = screen
      .getByRole("img", { name: "Alice" })
      .querySelector("img")!
      .getAttribute("src");

    expect(src).toBe("/avatars/user-1-100.png");
  });

  it("falls back to email for the label and initials when there is no name", () => {
    render(<UserAvatar email="dana@example.com" userId="u4" />);

    const avatar = screen.getByRole("img", { name: "dana@example.com" });

    expect(avatar).toHaveTextContent("DE");
  });
});

describe("getUserInitials", () => {
  it("derives up to two initials from names, emails, and separators", () => {
    expect(getUserInitials("Alice Smith")).toBe("AS");
    expect(getUserInitials("alice@example.com")).toBe("AE");
    expect(getUserInitials("solo")).toBe("S");
    expect(getUserInitials("a-b-c")).toBe("AB");
    expect(getUserInitials(null)).toBe("U");
  });
});
