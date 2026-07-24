import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import ProvenanceCard from "@/app/(app)/recipes/[id]/components/provenance-card";

const mockContext = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContext: () => mockContext(),
}));

vi.mock("@heroui/react", () => {
  const Card = Object.assign(({ children }: any) => <div>{children}</div>, {
    Content: ({ children }: any) => <div>{children}</div>,
  });

  return {
    Card,
    Chip: ({ children }: any) => <span data-testid="chip">{children}</span>,
    Separator: () => <hr />,
    Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
  };
});

function baseRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    name: "Lasagne",
    originCountryCode: null,
    region: null,
    cuisines: [],
    provenanceNote: null,
    ...overrides,
  };
}

describe("ProvenanceCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when idle with no provenance", () => {
    mockContext.mockReturnValue({ recipe: baseRecipe(), isInferringProvenance: false });

    const { container } = render(<ProvenanceCard />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a loading skeleton during first inference", () => {
    mockContext.mockReturnValue({ recipe: baseRecipe(), isInferringProvenance: true });

    render(<ProvenanceCard />);

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    // The localized pending label is exposed to assistive tech.
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("renders the localized country, cuisines, note, and AI-inferred framing on success", () => {
    mockContext.mockReturnValue({
      recipe: baseRecipe({
        originCountryCode: "IT",
        region: "Emilia-Romagna",
        cuisines: ["Italian", "Emilian"],
        provenanceNote: "A classic baked pasta dish.",
      }),
      isInferringProvenance: false,
    });

    const { container } = render(<ProvenanceCard />);

    expect(container.textContent).toContain("Italy"); // Intl-localized from "IT"
    expect(container.textContent).toContain("🇮🇹"); // derived flag
    expect(container.textContent).toContain("Emilia-Romagna");
    expect(screen.getAllByTestId("chip").map((c) => c.textContent)).toEqual(["Italian", "Emilian"]);
    expect(container.textContent).toContain("A classic baked pasta dish.");
    expect(screen.getByText("aiInferred")).toBeInTheDocument();
  });

  it("omits the flag and country for an uncertain (null) origin but still shows cuisines", () => {
    mockContext.mockReturnValue({
      recipe: baseRecipe({
        originCountryCode: null,
        cuisines: ["Fusion"],
        provenanceNote: "Origin uncertain.",
      }),
      isInferringProvenance: false,
    });

    const { container } = render(<ProvenanceCard />);

    expect(container.textContent).not.toContain("🇮🇹");
    expect(container.textContent).toContain("Fusion");
    expect(container.textContent).toContain("Origin uncertain.");
  });
});
