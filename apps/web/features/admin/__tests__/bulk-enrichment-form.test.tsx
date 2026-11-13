/** Bulk enrichment: the overwrite choice reaches the mutation and is forgotten after the run. */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

const enrichAll = vi.fn();
const sweepCounts = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("@norish/shared-react/admin", () => ({
  useEnrichAllRecipesMutation: () => ({ enrichAll, queued: undefined, isPending: false }),
  useImageGenerationSweepCount: () => sweepCounts.current,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("@/components/settings/settings-switch", () => ({
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

vi.mock("@heroui/react", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  let close = () => {};

  return {
    toast: vi.fn(),
    Button: ({ children, onPress }: { children?: React.ReactNode; onPress?: () => void }) => (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ),
    Modal: {
      Backdrop: ({
        children,
        isOpen,
        onOpenChange,
      }: {
        children?: React.ReactNode;
        isOpen: boolean;
        onOpenChange?: (open: boolean) => void;
      }) => {
        // The dialog's `close` asks the backdrop to close, as HeroUI's does.
        close = () => onOpenChange?.(false);

        return isOpen ? <div>{children}</div> : null;
      },
      Container: Passthrough,
      Dialog: ({
        children,
      }: {
        children?: React.ReactNode | ((dialog: { close: () => void }) => React.ReactNode);
      }) => (
        <div>{typeof children === "function" ? children({ close: () => close() }) : children}</div>
      ),
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
  await import("@/features/admin/components/ai/bulk-enrichment-form");

/** Opens the confirmation and returns its confirm button. */
function openConfirmation() {
  fireEvent.click(screen.getByText("button"));

  return screen.getByText("confirmButton");
}

beforeEach(() => {
  enrichAll.mockReset();
  sweepCounts.current = undefined;
});

describe("BulkEnrichmentForm", () => {
  it("sweeps without replacing when the switch is left alone", () => {
    render(<BulkEnrichmentForm />);
    fireEvent.click(openConfirmation());

    expect(enrichAll).toHaveBeenCalledWith(false);
  });

  it("carries the administrator's overwrite choice into the run", () => {
    render(<BulkEnrichmentForm />);
    openConfirmation();
    fireEvent.click(screen.getByTestId("replace-switch"));
    fireEvent.click(screen.getByText("confirmButtonReplace"));

    expect(enrichAll).toHaveBeenCalledWith(true);
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

    expect(enrichAll).toHaveBeenCalledWith(false);
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
