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

vi.mock("@/components/shared/ai-action-button", () => ({
  default: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));

vi.mock("@heroui/react", () => ({
  Card: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
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
      title: "Where it comes from",
      region: "Region",
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

    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.queryByText("No provenance information yet")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("shows an in-progress run to a reader who could not have started one", () => {
    mocks.canEdit = false;
    mocks.state = "queued";

    render(<ProvenanceCard />);

    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it("renders the country's flag and its name in the reader's language", () => {
    mocks.recipe.originCountry = "IT";
    mocks.recipe.provenanceNote = "Una classica ricetta romana.";

    render(<ProvenanceCard />);

    // The reader's locale is Dutch; the note stays in the recipe's language.
    expect(screen.getByText("Italië")).toBeInTheDocument();
    expect(screen.getByText("🇮🇹")).toBeInTheDocument();
    expect(screen.getByText("Una classica ricetta romana.")).toBeInTheDocument();
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

  it("offers the run to an editor when nothing is stored", () => {
    render(<ProvenanceCard />);

    screen.getByText("Work out with AI").click();

    expect(mocks.request).toHaveBeenCalledWith("recipe-provenance");
  });

  it("reports a retained terminal failure without hiding the action", () => {
    mocks.state = "failed";

    render(<ProvenanceCard />);

    expect(screen.getByText("Last run failed")).toBeInTheDocument();
    expect(screen.getByText("Work out with AI")).toBeInTheDocument();
  });
});
