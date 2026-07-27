import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import NutritionCard from "@/app/(app)/recipes/[id]/components/nutrition-card";

const mocks = vi.hoisted(() => ({
  canEdit: false,
  request: vi.fn(),
  state: "idle" as "idle" | "queued" | "processing" | "succeeded" | "failed",
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContext: () => ({
    recipe: {
      id: "recipe-1",
      userId: "owner-1",
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
    },
    enrichment: {
      states: { "nutrition-estimation": mocks.state },
      isBusy: () => mocks.state === "queued" || mocks.state === "processing",
      request: mocks.request,
    },
  }),
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({
    isAIEnabled: true,
    canEditRecipe: () => mocks.canEdit,
  }),
}));

vi.mock("@/components/recipes/readonly-nutrition", () => ({
  MACROS: [],
  getNutritionData: () => ({ hasData: false, values: {} }),
}));

vi.mock("@/components/recipes/nutrition-portion-control", () => ({
  default: () => null,
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
  Skeleton: () => <span />,
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const states: Record<string, string> = {
      "states.queued": "Queued",
      "states.processing": "In progress",
      "states.succeeded": "Completed",
      "states.failed": "Last run failed",
    };

    return namespace === "recipes.enrichment" ? (states[key] ?? key) : key;
  },
}));

describe("NutritionCard AI action authorization", () => {
  beforeEach(() => {
    mocks.canEdit = false;
    mocks.state = "idle";
    mocks.request.mockClear();
  });

  it("does not present enrichment to a viewer without edit permission", () => {
    render(<NutritionCard />);

    expect(screen.queryByRole("button", { name: "estimateWithAI" })).not.toBeInTheDocument();
  });

  it("lets an editor request nutrition enrichment", () => {
    mocks.canEdit = true;
    render(<NutritionCard />);

    fireEvent.click(screen.getByRole("button", { name: "estimateWithAI" }));

    expect(mocks.request).toHaveBeenCalledWith("nutrition-estimation");
  });

  it.each([
    ["queued", "Queued"],
    ["processing", "In progress"],
    ["succeeded", "Completed"],
    ["failed", "Last run failed"],
  ] as const)("renders the %s lifecycle state beside the control", (state, label) => {
    mocks.canEdit = true;
    mocks.state = state;

    render(<NutritionCard />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
