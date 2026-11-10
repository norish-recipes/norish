import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import SourceCard from "@/components/recipes/source-card";

vi.mock("@heroui/react", () => ({
  Card: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

describe("SourceCard", () => {
  it("shows the host and opens the original safely in a new tab", () => {
    render(<SourceCard recipe={{ url: "https://www.example.test/recipes/cacio-e-pepe" }} />);

    const link = screen.getByRole("link");

    expect(link).toHaveTextContent("example.test");
    expect(link).toHaveAttribute("href", "https://www.example.test/recipes/cacio-e-pepe");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("falls back to the stored string when it will not parse as a URL", () => {
    render(<SourceCard recipe={{ url: "grandma's notebook" }} />);

    expect(screen.getByRole("link")).toHaveTextContent("grandma's notebook");
  });

  it("renders nothing for a recipe with no URL", () => {
    const { container } = render(<SourceCard recipe={{ url: null }} />);

    expect(container).toBeEmptyDOMElement();
  });
});
