import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { ReadonlyRecipeSummary } from "@/components/recipes/readonly-recipe-sections";

vi.mock("@/components/recipes/author-chip", () => ({ default: () => null }));
vi.mock("@/components/shared/media-carousel", () => ({
  default: () => null,
  buildMediaItems: () => [],
}));
vi.mock("@/components/shared/smart-markdown-renderer", () => ({
  default: ({ text }: { text: string }) => <p>{text}</p>,
}));

vi.mock("@heroui/react", () => ({
  Chip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "nl",
  useTranslations: () => (key: string) => key,
}));

const RECIPE = {
  name: "Spaghetti Carbonara",
  description: null,
  url: null,
  categories: [] as never[],
  prepMinutes: null,
  cookMinutes: null,
  totalMinutes: null,
  tags: [],
};

describe("recipe title flag", () => {
  it("flies the origin country's flag before the name", () => {
    render(<ReadonlyRecipeSummary recipe={{ ...RECIPE, originCountry: "IT" }} />);

    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading).toHaveTextContent("🇮🇹");
    // Before, not after: the flag introduces the dish.
    expect(heading.textContent?.indexOf("🇮🇹")).toBeLessThan(
      heading.textContent!.indexOf("Spaghetti")
    );
  });

  it("names the country in the reader's language on hover", () => {
    const { container } = render(
      <ReadonlyRecipeSummary recipe={{ ...RECIPE, originCountry: "IT" }} />
    );

    // Dutch locale: the stored code decides nothing about how it reads.
    expect(container.querySelector("[title]")).toHaveAttribute("title", "Italië");
  });

  it("keeps the country out of the heading's accessible name", () => {
    render(<ReadonlyRecipeSummary recipe={{ ...RECIPE, originCountry: "IT" }} />);

    // The Provenance section already announces it; twice is noise, and a
    // country does not belong in a heading a reader navigates by.
    expect(screen.getByRole("heading", { level: 1, name: "Spaghetti Carbonara" })).toBeVisible();
  });

  it("shows no flag when the recipe has no origin country", () => {
    render(<ReadonlyRecipeSummary recipe={{ ...RECIPE, originCountry: null }} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Spaghetti Carbonara$/);
  });

  it("shows no flag for a recipe type that never carried an origin", () => {
    // Shared recipes reach this component without the field at all.
    render(<ReadonlyRecipeSummary recipe={RECIPE} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Spaghetti Carbonara$/);
  });

  it("shows no flag for a stored value that is not a country code", () => {
    render(<ReadonlyRecipeSummary recipe={{ ...RECIPE, originCountry: "Italy" }} />);

    // Two stray regional-indicator letters would be worse than nothing.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Spaghetti Carbonara$/);
  });
});
