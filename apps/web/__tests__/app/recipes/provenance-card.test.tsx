import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import ProvenanceCard from "@/app/(app)/recipes/[id]/components/provenance-card";

type LifecycleState = "idle" | "queued" | "processing" | "succeeded" | "failed";

const mocks = vi.hoisted(() => ({
  canEdit: true,
  isAIEnabled: true,
  request: vi.fn(),
  state: "idle" as LifecycleState,
  recipe: {
    id: "recipe-1",
    userId: "owner-1",
    originCountry: null as string | null,
    originRegion: null as string | null,
    provenanceNote: null as string | null,
    cuisines: [] as { id: string; name: string; version: number }[],
  },
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContext: () => ({
    recipe: mocks.recipe,
    enrichment: {
      states: { "recipe-provenance": mocks.state },
      isBusy: () => mocks.state === "queued" || mocks.state === "processing",
      request: mocks.request,
    },
  }),
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({
    isAIEnabled: mocks.isAIEnabled,
    canEditRecipe: () => mocks.canEdit,
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
  useTranslations: (namespace: string) => (key: string) => {
    const enrichment: Record<string, string> = {
      "states.queued": "Queued",
      "states.processing": "In progress",
      "states.failed": "Last run failed",
    };
    const provenance: Record<string, string> = {
      title: "Provenance",
      region: "Region",
      cuisines: "Cuisines",
      noInfo: "No provenance information yet",
      inferWithAI: "Work out with AI",
    };

    return namespace === "recipes.enrichment" ? (enrichment[key] ?? key) : (provenance[key] ?? key);
  },
}));

beforeEach(() => {
  mocks.canEdit = true;
  mocks.isAIEnabled = true;
  mocks.state = "idle";
  mocks.request.mockClear();
  mocks.recipe = {
    id: "recipe-1",
    userId: "owner-1",
    originCountry: null,
    originRegion: null,
    provenanceNote: null,
    cuisines: [],
  };
});

describe("Recipe Provenance section", () => {
  it("is absent when there is no provenance, no run in progress, and no action to offer", () => {
    mocks.canEdit = false;

    const { container } = render(<ProvenanceCard />);

    expect(container).toBeEmptyDOMElement();
  });

  it("is absent when AI is disabled and nothing is stored", () => {
    mocks.isAIEnabled = false;

    const { container } = render(<ProvenanceCard />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders an in-progress run rather than an empty section", () => {
    mocks.state = "processing";

    render(<ProvenanceCard />);

    // A skeleton under the section's own name, and no running commentary: the
    // shape is what says work is happening.
    expect(screen.getByText("Provenance")).toBeInTheDocument();
    expect(screen.queryByText("In progress")).not.toBeInTheDocument();
    expect(screen.queryByText("No provenance information yet")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("shows an in-progress run to a reader who could not have started one", () => {
    mocks.canEdit = false;
    mocks.state = "queued";

    render(<ProvenanceCard />);

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("does not pre-empt the title with a country a run has not produced yet", () => {
    // Stale provenance must not headline a card that is being replaced.
    mocks.recipe.originCountry = "IT";
    mocks.state = "processing";

    render(<ProvenanceCard />);

    expect(screen.getByText("Provenance")).toBeInTheDocument();
    expect(screen.queryByText("Italia")).not.toBeInTheDocument();
  });

  it("makes the country the card's title, in its own language", () => {
    mocks.recipe.originCountry = "IT";
    mocks.recipe.provenanceNote = "Una classica ricetta romana.";

    render(<ProvenanceCard />);

    // The reader's locale is Dutch; the endonym still titles the card, so it
    // reads in step with the note, which is in the recipe's language.
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
    expect(screen.queryByText("No provenance information yet")).not.toBeInTheDocument();
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
    expect(screen.queryByText("No provenance information yet")).not.toBeInTheDocument();
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
});
