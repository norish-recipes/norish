import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

let mockCurrentUser: { id: string } | null = { id: "user-1" };

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({ user: mockCurrentUser }),
}));

vi.mock("@heroui/react", () => ({
  Avatar: ({ src, name }: { src?: string; name?: string }) => (
    <img alt={name || "avatar"} src={src} />
  ),
}));

import AuthorChip from "@/app/(app)/recipes/[id]/components/author-chip";

describe("AuthorChip avatar src", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = { id: "user-1" };
  });

  it("uses plain avatar URL without cache-busting query params", () => {
    render(<AuthorChip image="/avatars/user-1.png" name="Alice" userId="user-1" />);

    const src = screen.getByAltText("A").getAttribute("src");

    expect(src).toBe("/avatars/user-1.png");
  });
});
