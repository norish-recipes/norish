/**
 * The dialog a round of Ask AI starts from: which flagged ingredients, how
 * many each choice holds across the catalogue and about how many tokens it
 * takes, side by side, and what the tokens are based on.
 */
import { AskAIRoundModal } from "@/app/(app)/settings/ingredients/components/ask-ai-round-modal";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { ReviewScopeSummary } from "@norish/shared/contracts/ingredient-catalogue";

/** What `reviewScope` answers; undefined while it loads. */
let summary: ReviewScopeSummary | undefined;

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    ingredients: {
      reviewScope: { queryOptions: () => ({ queryKey: ["ingredients.reviewScope"] }) },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ enabled }: { enabled?: boolean }) => ({
    data: enabled ? summary : undefined,
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
  return render(<AskAIRoundModal isOpen isStarting={false} onClose={onClose} onStart={onStart} />);
}

const radio = (scope: "unsuggested" | "flagged") =>
  screen.getByRole("radio", { name: `askAIRound.scopes.${scope}` });

beforeEach(() => {
  onStart.mockClear();
  onClose.mockClear();
  // 3,553 tokens a food: 1,955 on the language model, 1,598 on the Decision Model.
  summary = {
    flagged: 1337,
    unsuggested: 935,
    tokens: {
      basis: "measured",
      foods: 200,
      models: [
        { provider: "openai", model: "gpt-5.6-luna", perFood: 1955 },
        { provider: "typesafe", model: "jev-1.13.0", perFood: 1598 },
      ],
    },
  };
});

describe("AskAIRoundModal", () => {
  it("starts on the ingredients without a suggestion, and prices both choices side by side", () => {
    renderOpen();

    expect(radio("unsuggested")).toBeChecked();
    expect(radio("flagged")).not.toBeChecked();
    // 935 × 3,553 = 3,322,055 and 1,337 × 3,553 = 4,750,361.
    expect(screen.getByText("askAIRound.scopeSize(count=935,tokens=3.3M)")).toBeInTheDocument();
    expect(screen.getByText("askAIRound.scopeSize(count=1337,tokens=4.8M)")).toBeInTheDocument();
    // Asking about every one replaces what is waiting, and says so.
    expect(screen.getByText("askAIRound.replaces")).toBeInTheDocument();
    expect(screen.getByTestId("ingredients-ask-ai-start")).toHaveTextContent("askAI");
  });

  it("splits the chosen round's tokens between the models it asks, measured over the last round", () => {
    renderOpen();
    const models = screen.getByTestId("ingredients-ask-ai-models");

    // 935 × 1,955 = 1,827,925 and 935 × 1,598 = 1,494,130.
    expect(models).toHaveTextContent("openai · gpt-5.6-luna");
    expect(models).toHaveTextContent("askAIRound.modelTokens(tokens=1.8M)");
    expect(models).toHaveTextContent("typesafe · jev-1.13.0");
    expect(models).toHaveTextContent("askAIRound.modelTokens(tokens=1.5M)");
    expect(screen.getByTestId("ingredients-ask-ai-tokens")).toHaveTextContent(
      "askAIRound.basisMeasured"
    );
  });

  it("starts the round over every flagged ingredient when that is picked", () => {
    renderOpen();

    fireEvent.click(radio("flagged"));

    expect(radio("flagged")).toBeChecked();
    // The split follows the choice: 1,337 × 1,955 = 2,613,835 and 1,337 × 1,598 = 2,136,526.
    expect(screen.getByTestId("ingredients-ask-ai-models")).toHaveTextContent(
      "askAIRound.modelTokens(tokens=2.6M)"
    );
    expect(screen.getByTestId("ingredients-ask-ai-models")).toHaveTextContent(
      "askAIRound.modelTokens(tokens=2.1M)"
    );
    fireEvent.click(screen.getByTestId("ingredients-ask-ai-start"));

    expect(onStart).toHaveBeenCalledExactlyOnceWith("flagged");
  });

  it("starts on every flagged ingredient when none is left without a suggestion", () => {
    summary = { ...summary!, unsuggested: 0 };
    renderOpen();

    expect(radio("unsuggested")).toBeDisabled();
    expect(radio("flagged")).toBeChecked();
    fireEvent.click(screen.getByTestId("ingredients-ask-ai-start"));

    expect(onStart).toHaveBeenCalledExactlyOnceWith("flagged");
  });

  it("says the estimate comes from the prompt before any round was measured", () => {
    summary = {
      ...summary!,
      tokens: {
        basis: "prompt",
        models: [{ provider: "openai", model: "gpt-5.6-luna", perFood: 2600 }],
      },
    };
    renderOpen();

    expect(screen.getByTestId("ingredients-ask-ai-tokens")).toHaveTextContent(
      "askAIRound.basisPrompt"
    );
    // 935 × 2,600 = 2,431,000.
    expect(screen.getByText("askAIRound.scopeSize(count=935,tokens=2.4M)")).toBeInTheDocument();
  });

  it("cannot start before the counts are in, and closes without asking", () => {
    summary = undefined;
    renderOpen();

    expect(screen.getByTestId("ingredients-ask-ai-start")).toBeDisabled();
    expect(screen.queryByTestId("ingredients-ask-ai-tokens")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
  });
});
