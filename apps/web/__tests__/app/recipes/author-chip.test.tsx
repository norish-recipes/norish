import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import AuthorChip from "@/components/recipes/author-chip";

let mockCurrentUser: { id: string } | null = { id: "user-1" };

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({ user: mockCurrentUser }),
}));

describe("AuthorChip avatar src", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = { id: "user-1" };
  });

  it("uses plain avatar URL without cache-busting query params", () => {
    render(<AuthorChip image="/avatars/user-1.png" name="Alice" userId="user-1" />);

    const avatar = screen.getByRole("img", { name: "Alice" });
    const src = avatar.querySelector("img")?.getAttribute("src");

    expect(src).toBe("/avatars/user-1.png");
  });
});
