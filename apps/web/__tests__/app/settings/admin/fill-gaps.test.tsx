/**
 * Fill gaps: a box per kind with how many listed foods it would fill, Icons only where the image
 * provider draws, and a confirm that starts the run over the boxes picked; no run while one is on.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

const mutate = vi.fn();
const counts = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    admin: {
      ingredientCatalogue: {
        fillGapsCounts: { queryOptions: (_input: unknown, options: unknown) => options },
        fillGaps: { mutationOptions: (options: unknown) => options },
      },
    },
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate, isPending: false }),
  useQuery: () => ({ data: counts.current, refetch: vi.fn() }),
}));
vi.mock("@/app/(app)/settings/admin/context", () => ({
  useAdminSettingsContext: () => ({ aiConfig: { enabled: true } }),
}));
vi.mock("@/lib/ui/safe-error-toast", () => ({ showSafeErrorToast: vi.fn() }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const { default: FillGaps } = await import("@/app/(app)/settings/admin/components/fill-gaps");

beforeEach(() => {
  mutate.mockReset();
  counts.current = { nutrition: 4, conversions: 0, icons: 2, running: false };
});

const box = (kind: string) => screen.getByRole("checkbox", { name: `kinds.${kind}` });

describe("FillGaps", () => {
  it("names each box's count and starts the run over the boxes picked", () => {
    render(<FillGaps />);
    fireEvent.click(screen.getByTestId("fill-gaps"));

    expect(screen.getByTestId("fill-gaps-nutrition")).toHaveTextContent('count:{"count":4}');
    expect(screen.getByTestId("fill-gaps-icons")).toHaveTextContent('count:{"count":2}');
    // Nothing picked yet, and nothing to fill is no choice.
    expect(screen.getByTestId("fill-gaps-start")).toBeDisabled();
    expect(box("conversions")).toBeDisabled();

    fireEvent.click(box("nutrition"));
    fireEvent.click(box("icons"));
    fireEvent.click(screen.getByTestId("fill-gaps-start"));

    expect(mutate).toHaveBeenCalledWith({ nutrition: true, conversions: false, icons: true });
  });

  it("offers no Icons where nothing can draw", () => {
    counts.current = { nutrition: 4, conversions: 1, icons: null, running: false };
    render(<FillGaps />);
    fireEvent.click(screen.getByTestId("fill-gaps"));

    expect(screen.getByTestId("fill-gaps-nutrition")).toBeInTheDocument();
    expect(screen.queryByTestId("fill-gaps-icons")).toBeNull();
  });

  it("is disabled while a run is on", () => {
    counts.current = { nutrition: 4, conversions: 1, icons: 2, running: true };
    render(<FillGaps />);

    expect(screen.getByTestId("fill-gaps")).toBeDisabled();
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});
