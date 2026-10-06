/**
 * Bulk enrichment: the administrator's per-run overwrite choice.
 *
 * The destructive part of this feature is a boolean that has to survive the
 * trip from a switch to the mutation, and has to be forgotten afterwards —
 * a sweep that silently remembers "overwrite" from last time is the failure
 * this pins against.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

const mutate = vi.fn();
const mockUseTRPC = vi.fn();
const sweepCounts = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("@/app/providers/trpc-provider", () => ({ useTRPC: mockUseTRPC }));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate, isPending: false, isSuccess: false, data: undefined }),
  useQuery: () => ({ data: sweepCounts.current }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("@/lib/ui/safe-error-toast", () => ({ showSafeErrorToast: vi.fn() }));

vi.mock("@/app/(app)/settings/components/settings-switch", () => ({
  default: ({
    isSelected,
    onValueChange,
  }: {
    isSelected: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <button
      aria-pressed={isSelected}
      data-testid="replace-switch"
      onClick={() => onValueChange(!isSelected)}
    >
      replace
    </button>
  ),
}));

vi.mock("@heroicons/react/16/solid", () => ({ ExclamationTriangleIcon: () => <span /> }));

vi.mock("@heroui/react", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

  return {
    toast: vi.fn(),
    Button: ({ children, onPress }: { children?: React.ReactNode; onPress?: () => void }) => (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ),
    Modal: {
      Backdrop: ({ children, isOpen }: { children?: React.ReactNode; isOpen: boolean }) =>
        isOpen ? <div>{children}</div> : null,
      Container: Passthrough,
      Dialog: Passthrough,
      Header: Passthrough,
      Body: Passthrough,
      Footer: Passthrough,
    },
    Alert: Object.assign(Passthrough, {
      Indicator: () => null,
      Content: Passthrough,
      Title: Passthrough,
    }),
  };
});

const { default: BulkEnrichmentForm } =
  await import("@/app/(app)/settings/admin/components/bulk-enrichment-form");

/** Opens the confirmation and returns its confirm button. */
function openConfirmation() {
  fireEvent.click(screen.getByText("button"));

  return screen.getByText("confirmButton");
}

beforeEach(() => {
  vi.clearAllMocks();
  sweepCounts.current = undefined;
  mockUseTRPC.mockReturnValue({
    admin: {
      enrichAllRecipes: { mutationOptions: (options: unknown) => options },
      imageGenerationSweepCount: { queryOptions: (_input: unknown, options: unknown) => options },
    },
  });
});

describe("BulkEnrichmentForm", () => {
  it("sweeps without replacing when the switch is left alone", () => {
    render(<BulkEnrichmentForm />);
    fireEvent.click(openConfirmation());

    expect(mutate).toHaveBeenCalledWith({ replaceExisting: false });
  });

  it("carries the administrator's overwrite choice into the run", () => {
    render(<BulkEnrichmentForm />);
    openConfirmation();
    fireEvent.click(screen.getByTestId("replace-switch"));
    fireEvent.click(screen.getByText("confirmButtonReplace"));

    expect(mutate).toHaveBeenCalledWith({ replaceExisting: true });
  });

  it("names the destructive action differently once overwriting is on", () => {
    render(<BulkEnrichmentForm />);
    openConfirmation();

    expect(screen.queryByText("replaceWarning")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("replace-switch"));

    expect(screen.getByText("replaceWarning")).toBeInTheDocument();
    expect(screen.queryByText("confirmButton")).not.toBeInTheDocument();
  });

  it("forgets the choice when the confirmation is opened again", () => {
    render(<BulkEnrichmentForm />);
    openConfirmation();
    fireEvent.click(screen.getByTestId("replace-switch"));
    fireEvent.click(screen.getByText("cancel"));

    // Reopening starts from gap-filling: overwriting is chosen each time.
    fireEvent.click(openConfirmation());

    expect(mutate).toHaveBeenCalledWith({ replaceExisting: false });
  });
});

describe("the image count the confirmation names", () => {
  it("shows the gap count by default and the overwrite count once toggled", () => {
    sweepCounts.current = { enabled: true, gapOnly: 4, overwrite: 12 };
    render(<BulkEnrichmentForm />);
    openConfirmation();

    expect(screen.getByText('imageCount:{"count":4}')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("replace-switch"));

    expect(screen.getByText('imageCount:{"count":12}')).toBeInTheDocument();
  });

  it("leaves the modal exactly as it is today when the kind is switched off", () => {
    sweepCounts.current = { enabled: false };
    render(<BulkEnrichmentForm />);
    openConfirmation();

    expect(screen.queryByText(/imageCount/)).not.toBeInTheDocument();
  });
});
