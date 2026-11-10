import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "@testing-library/jest-dom";

import AuthorChip from "@/components/recipes/author-chip";

describe("AuthorChip avatar src", () => {
  it("uses plain avatar URL without cache-busting query params", () => {
    render(<AuthorChip image="/avatars/user-1.png" name="Alice" userId="user-1" />);

    const avatar = screen.getByRole("img", { name: "Alice" });
    const src = avatar.querySelector("img")?.getAttribute("src");

    expect(src).toBe("/avatars/user-1.png");
  });
});
