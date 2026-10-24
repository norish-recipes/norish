/**
 * Clean up catalogue: a scope, the count of foods it asks about, and a confirm that starts the run;
 * no run while AI is off or one is on.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

const mutate = vi.fn();
const counts = vi.hoisted(() => ({ current: undefined as unknown }));
const context = vi.hoisted(() => ({ aiConfig: { enabled: true } as unknown }));

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    admin: {
      ingredientCatalogue: {
        cleanUpCounts: { queryOptions: (_input: unknown, options: unknown) => options },
        cleanUp: { mutationOptions: (options: unknown) => options },
      },
    },
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate, isPending: false }),
  useQuery: () => ({ data: counts.current, refetch: vi.fn() }),
}));
vi.mock("@/app/(app)/settings/admin/context", () => ({ useAdminSettingsContext: () => context }));
vi.mock("@/lib/ui/safe-error-toast", () => ({ showSafeErrorToast: vi.fn() }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const { default: CleanUpCatalogue } =
  await import("@/app/(app)/settings/admin/components/clean-up-catalogue");

beforeEach(() => {
  mutate.mockReset();
  counts.current = { recipeFoods: 2, wholeCatalogue: 40, running: false };
  context.aiConfig = { enabled: true };
});

describe("CleanUpCatalogue", () => {
  it("names each scope's count and starts the run over the one picked", () => {
    render(<CleanUpCatalogue />);
    fireEvent.click(screen.getByTestId("clean-up-catalogue"));

    expect(screen.getByTestId("clean-up-count")).toHaveTextContent('count:{"count":2}');
    fireEvent.click(screen.getByRole("radio", { name: "scopes.whole-catalogue" }));
    expect(screen.getByTestId("clean-up-count")).toHaveTextContent('count:{"count":40}');
    fireEvent.click(screen.getByTestId("clean-up-catalogue-start"));

    expect(mutate).toHaveBeenCalledWith({ scope: "whole-catalogue" });
  });

  it("is disabled while a run is on, or AI is off", () => {
    counts.current = { recipeFoods: 2, wholeCatalogue: 40, running: true };
    const { unmount } = render(<CleanUpCatalogue />);

    expect(screen.getByTestId("clean-up-catalogue")).toBeDisabled();
    expect(screen.getByText("running")).toBeInTheDocument();
    unmount();

    counts.current = { recipeFoods: 2, wholeCatalogue: 40, running: false };
    context.aiConfig = { enabled: false };
    render(<CleanUpCatalogue />);
    expect(screen.getByTestId("clean-up-catalogue")).toBeDisabled();
  });
});
