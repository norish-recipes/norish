import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import AuthorChip from "@/components/recipes/author-chip";

let mockCurrentUser: { id: string } | null = { id: "user-1" };

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({ user: mockCurrentUser }),
}));

vi.mock("@heroui/react", () => ({
  Avatar: Object.assign(({ children }: { children: React.ReactNode }) => <>{children}</>, {
    Image: ({ alt, src }: { alt?: string; src?: string }) => (
      <img alt={alt || "avatar"} src={src} />
    ),
    Fallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  }),
}));

describe("AuthorChip avatar src", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = { id: "user-1" };
  });

  it("uses plain avatar URL without cache-busting query params", () => {
    render(<AuthorChip image="/avatars/user-1.png" name="Alice" userId="user-1" />);

    const src = screen.getByAltText("Alice").getAttribute("src");

    expect(src).toBe("/avatars/user-1.png");
  });
});
