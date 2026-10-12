/**
 * The dialog a round of Fix catalogue starts from: which parts of the
 * catalogue, any together, how many ingredients each holds across the
 * catalogue and about how many tokens it takes, side by side, and what the
 * picked parts take per model and what that is based on.
 */
import { FixCatalogueModal } from "@/app/(app)/settings/ingredients/components/fix-catalogue-modal";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type {
  NameScopeSummary,
  ReviewScopeSummary,
} from "@norish/shared/contracts/ingredient-catalogue";

/** What `reviewScope` answers; undefined while it loads. */
let summary: ReviewScopeSummary | undefined;
/** What `nameScope` answers; undefined while it loads. */
let names: NameScopeSummary | undefined;

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    ingredients: {
      reviewScope: { queryOptions: () => ({ queryKey: ["ingredients.reviewScope"] }) },
      nameScope: { queryOptions: () => ({ queryKey: ["ingredients.nameScope"] }) },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey, enabled }: { queryKey: string[]; enabled?: boolean }) => ({
    data: enabled ? (queryKey[0] === "ingredients.nameScope" ? names : summary) : undefined,
    isError: false,
  }),
}));

// A message reads as its key and the values it was given, so a test can see the numbers.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values
      ? `${key}(${Object.entries(values)
          .map(([name, value]) => `${name}=${String(value)}`)
          .join(",")})`
      : key,
  useFormatter: () => ({
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat("en", options).format(value),
  }),
}));

const onStart = vi.fn();
const onClose = vi.fn();

function renderOpen() {
  return render(
    <FixCatalogueModal isOpen isStarting={false} onClose={onClose} onStart={onStart} />
  );
}

const box = (part: "unsuggested" | "suggested" | "name") =>
  screen.getByRole("checkbox", { name: `askAIRound.scopes.${part}` });

beforeEach(() => {
  onStart.mockClear();
  onClose.mockClear();
  // 3,553 tokens a flagged food: 1,955 on the language model, 1,598 on the Decision Model.
  summary = {
    unsuggested: 935,
    suggested: 402,
    tokens: {
      basis: "measured",
      foods: 200,
      models: [
        { provider: "openai", model: "gpt-5.6-luna", perFood: 1955 },
        { provider: "typesafe", model: "jev-1.13.0", perFood: 1598 },
      ],
    },
  };
  // 410 tokens a name, on the language model alone.
  names = {
    foods: 412,
    tokens: {
      basis: "prompt",
      models: [{ provider: "openai", model: "gpt-5.6-luna", perFood: 410 }],
    },
  };
});

describe("FixCatalogueModal", () => {
  it("picks the flagged ingredients without a suggestion and the names, and prices every part side by side", () => {
    renderOpen();

    expect(box("unsuggested")).toBeChecked();
    // Asking again replaces what is waiting, so it is never picked for the person.
    expect(box("suggested")).not.toBeChecked();
    expect(box("name")).toBeChecked();
    // 935 × 3,553 = 3,322,055, 402 × 3,553 = 1,428,306 and 412 × 410 = 168,920.
    expect(screen.getByText("askAIRound.scopeSize(count=935,tokens=3.3M)")).toBeInTheDocument();
    expect(screen.getByText("askAIRound.scopeSize(count=402,tokens=1.4M)")).toBeInTheDocument();
    expect(screen.getByText("askAIRound.scopeSize(count=412,tokens=168.9K)")).toBeInTheDocument();
    expect(screen.getByText("askAIRound.hints.suggested")).toBeInTheDocument();
    expect(screen.getByText("askAIRound.hints.name")).toBeInTheDocument();
    expect(screen.getByTestId("ingredients-fix-catalogue-start")).toHaveTextContent("askAI");
  });

  it("adds up the picked parts' tokens per model, each part at its own question's price", () => {
    renderOpen();
    const models = () => screen.getByTestId("ingredients-fix-catalogue-models");
    const basis = () => screen.queryByTestId("ingredients-fix-catalogue-tokens");

    // 935 × 1,955 + 412 × 410 = 1,996,845 on the language model, 935 × 1,598 = 1,494,130 on Jev.
    expect(models()).toHaveTextContent("openai · gpt-5.6-luna");
    expect(models()).toHaveTextContent("askAIRound.modelTokens(tokens=2M)");
    expect(models()).toHaveTextContent("typesafe · jev-1.13.0");
    expect(models()).toHaveTextContent("askAIRound.modelTokens(tokens=1.5M)");
    // The names were never measured, so the round's estimate says nothing of a last round.
    expect(basis()).toBeNull();

    fireEvent.click(box("name"));

    // 935 × 1,955 = 1,827,925, all measured.
    expect(models()).toHaveTextContent("askAIRound.modelTokens(tokens=1.8M)");
    expect(basis()).toHaveTextContent("askAIRound.basisMeasured");
  });

  it("starts one round over every part picked", () => {
    renderOpen();

    fireEvent.click(box("suggested"));
    fireEvent.click(screen.getByTestId("ingredients-fix-catalogue-start"));

    expect(onStart).toHaveBeenCalledExactlyOnceWith(["unsuggested", "suggested", "name"]);
  });

  it("leaves out a part with nothing in it", () => {
    summary = { ...summary!, unsuggested: 0 };
    renderOpen();

    expect(box("unsuggested")).toBeDisabled();
    expect(box("unsuggested")).not.toBeChecked();
    fireEvent.click(screen.getByTestId("ingredients-fix-catalogue-start"));

    expect(onStart).toHaveBeenCalledExactlyOnceWith(["name"]);
  });

  it("cannot start with nothing picked", () => {
    renderOpen();

    fireEvent.click(box("unsuggested"));
    fireEvent.click(box("name"));

    expect(screen.getByTestId("ingredients-fix-catalogue-start")).toBeDisabled();
    expect(screen.queryByTestId("ingredients-fix-catalogue-models")).toBeNull();
  });

  it("cannot start before the counts are in, and closes without asking", () => {
    summary = undefined;
    renderOpen();

    expect(screen.getByTestId("ingredients-fix-catalogue-start")).toBeDisabled();
    expect(screen.queryByTestId("ingredients-fix-catalogue-models")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });
});
