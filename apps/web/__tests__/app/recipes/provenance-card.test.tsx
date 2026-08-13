import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import ProvenanceCard from "@/app/(app)/recipes/[id]/components/provenance-card";

type LifecycleState = "idle" | "queued" | "processing" | "succeeded" | "failed";

const mocks = vi.hoisted(() => ({
  state: "idle" as LifecycleState,
  hidden: [] as string[],
  recipe: {
    id: "recipe-1",
    userId: "owner-1",
    originCountry: null as string | null,
    originCountryName: null as string | null,
    originRegion: null as string | null,
    provenanceNote: null as string | null,
    cuisines: [] as { id: string; name: string; version: number }[],
  },
}));

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({ user: { id: "owner-1", preferences: { hidden: mocks.hidden } } }),
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContext: () => ({
    recipe: mocks.recipe,
    enrichment: {
      states: { "recipe-provenance": mocks.state },
      isBusy: () => mocks.state === "queued" || mocks.state === "processing",
    },
  }),
}));

vi.mock("@heroui/react", () => ({
  Card: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  Chip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Separator: () => <hr />,
  Skeleton: () => <span data-testid="skeleton" />,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "nl",
  useTranslations: () => (key: string) => {
    const provenance: Record<string, string> = {
      title: "Provenance",
      region: "Region",
      cuisines: "Cuisines",
    };

    return provenance[key] ?? key;
  },
}));

beforeEach(() => {
  mocks.state = "idle";
  mocks.hidden = [];
  mocks.recipe = {
    id: "recipe-1",
    userId: "owner-1",
    originCountry: null,
    originCountryName: null,
    originRegion: null,
    provenanceNote: null,
    cuisines: [],
  };
});

describe("Recipe Provenance section", () => {
  it("is absent when nothing is stored and no run is in flight", () => {
    const { container } = render(<ProvenanceCard />);

    expect(container).toBeEmptyDOMElement();
  });

  it("stays absent after a failed run when nothing is stored", () => {
    // A quiet automatic failure leaves no empty panel behind.
    mocks.state = "failed";

    const { container } = render(<ProvenanceCard />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders an in-progress run rather than an empty section", () => {
    mocks.state = "processing";

    render(<ProvenanceCard />);

    // A skeleton under the section's own name: the shape is what says work
    // is happening.
    expect(screen.getByText("Provenance")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("shows the skeleton while a run is still queued", () => {
    mocks.state = "queued";

    render(<ProvenanceCard />);

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("does not pre-empt the title with a country a run has not produced yet", () => {
    // Stale provenance must not headline a card that is being replaced.
    mocks.recipe.originCountry = "IT";
    mocks.recipe.originCountryName = "Italia";
    mocks.state = "processing";

    render(<ProvenanceCard />);

    expect(screen.getByText("Provenance")).toBeInTheDocument();
    expect(screen.queryByText("Italia")).not.toBeInTheDocument();
  });

  it("titles the card with the stored written name, in the recipe's language", () => {
    // A Dutch recipe about a Turkish dish: the stored name speaks the language
    // of the note beside it, not the country's own or the reader's.
    mocks.recipe.originCountry = "TR";
    mocks.recipe.originCountryName = "Turkije";
    mocks.recipe.provenanceNote = "Dit gerecht komt uit de Turkse keuken.";

    render(<ProvenanceCard />);

    expect(screen.getByRole("heading", { name: /Turkije/ })).toBeInTheDocument();
    expect(screen.getByText("🇹🇷")).toBeInTheDocument();
    expect(screen.queryByText("Provenance")).not.toBeInTheDocument();
  });

  it("falls back to the endonym when a row has a code but no stored name", () => {
    mocks.recipe.originCountry = "IT";
    mocks.recipe.originCountryName = null;
    mocks.recipe.provenanceNote = "Una classica ricetta romana.";

    render(<ProvenanceCard />);

    // The reader's locale is Dutch; the endonym still titles the card until a
    // run stores a written name, so nothing ever renders as a bare code.
    expect(screen.getByRole("heading", { name: /Italia/ })).toBeInTheDocument();
    expect(screen.getByText("🇮🇹")).toBeInTheDocument();
    expect(screen.getByText("Una classica ricetta romana.")).toBeInTheDocument();
    // The generic name gives way once there is a real answer.
    expect(screen.queryByText("Provenance")).not.toBeInTheDocument();
  });

  it("falls back to naming itself when there is no country", () => {
    mocks.recipe.originRegion = "Lazio";

    render(<ProvenanceCard />);

    expect(screen.getByText("Provenance")).toBeInTheDocument();
  });

  it("shows the region only when there is one", () => {
    mocks.recipe.originCountry = "IT";
    mocks.recipe.provenanceNote = "Una classica ricetta romana.";

    const { rerender } = render(<ProvenanceCard />);

    expect(screen.queryByText("Region")).not.toBeInTheDocument();

    mocks.recipe.originRegion = "Lazio";
    rerender(<ProvenanceCard />);

    expect(screen.getByText("Lazio")).toBeInTheDocument();
  });

  it("renders a note on its own, without a country", () => {
    mocks.recipe.provenanceNote = "Dit gerecht is niet aan één land te koppelen.";

    render(<ProvenanceCard />);

    expect(screen.getByText("Dit gerecht is niet aan één land te koppelen.")).toBeInTheDocument();
    // The section still names itself, since there is no country to title it.
    expect(screen.getByText("Provenance")).toBeInTheDocument();
  });

  it("shows the recipe's Cuisines verbatim, whatever the reader's language", () => {
    mocks.recipe.originCountry = "IT";
    mocks.recipe.cuisines = [
      { id: "id-italian", name: "Italian", version: 1 },
      { id: "id-mediterranean", name: "Mediterranean", version: 1 },
    ];

    render(<ProvenanceCard />);

    // A Cuisine name is a canonical identifier, not a translatable label.
    expect(screen.getByText("Italian")).toBeInTheDocument();
    expect(screen.getByText("Mediterranean")).toBeInTheDocument();
  });

  it("renders a recipe whose only provenance is its Cuisines", () => {
    mocks.recipe.cuisines = [{ id: "id-italian", name: "Italian", version: 1 }];

    render(<ProvenanceCard />);

    expect(screen.getByText("Italian")).toBeInTheDocument();
  });

  it("omits the Cuisines row when there are none", () => {
    mocks.recipe.originCountry = "IT";
    mocks.recipe.provenanceNote = "Una classica ricetta romana.";

    render(<ProvenanceCard />);

    expect(screen.queryByText("Cuisines")).not.toBeInTheDocument();
  });

  it("keeps showing stored provenance after a run failed", () => {
    // A quiet automatic failure leaves the section showing whatever is stored.
    mocks.state = "failed";
    mocks.recipe.originCountry = "IT";

    render(<ProvenanceCard />);

    expect(screen.getByText("Italia")).toBeInTheDocument();
  });

  it("is absent when the reader has hidden Recipe Provenance", () => {
    mocks.hidden = ["provenance"];
    mocks.recipe.originCountry = "IT";

    const { container } = render(<ProvenanceCard />);

    expect(container).toBeEmptyDOMElement();
  });

  it("stays absent for a hiding reader even while a run is in flight", () => {
    mocks.hidden = ["provenance"];
    mocks.state = "processing";

    const { container } = render(<ProvenanceCard />);

    expect(container).toBeEmptyDOMElement();
  });
});
