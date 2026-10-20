import type { BulkImportTrackerItem } from "@/context/bulk-import-state";
import type { ReactNode } from "react";
import BulkImageImport from "@/components/import/bulk-image-import";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  items: [] as BulkImportTrackerItem[],
  retry: vi.fn(),
  isAIEnabled: true,
}));

vi.mock("@/context/bulk-import-context", () => ({
  useBulkImport: () => ({ items: mocks.items, retry: mocks.retry }),
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({ isAIEnabled: mocks.isAIEnabled }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/dashboard/importing-recipe-card", () => ({
  default: ({
    item,
    variant,
    onRetry,
  }: {
    item: BulkImportTrackerItem;
    variant: string;
    onRetry: (items: readonly BulkImportTrackerItem[]) => void;
  }) => (
    <div data-testid="importing-card" data-variant={variant}>
      <span>{item.filename}</span>
      {item.status === "failed" ? (
        <button type="button" onClick={() => onRetry([item])}>
          Retry
        </button>
      ) : null}
    </div>
  ),
}));

function item(overrides: Partial<BulkImportTrackerItem> = {}): BulkImportTrackerItem {
  return {
    itemId: "item-1",
    position: 0,
    filename: "page.png",
    status: "processing",
    recipeId: null,
    errorCode: null,
    previewUrl: null,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.items = [];
  mocks.retry.mockReset();
  mocks.isAIEnabled = true;
});

describe("BulkImageImport", () => {
  it("draws the shared tracker items through the list card", () => {
    const failed = item({
      itemId: "item-2",
      position: 1,
      filename: "failed.png",
      status: "failed",
      errorCode: "extraction-failed",
    });

    mocks.items = [item(), failed];

    render(<BulkImageImport />);

    expect(screen.getByText("page.png")).toBeInTheDocument();
    expect(screen.getByText("failed.png")).toBeInTheDocument();
    expect(screen.getAllByTestId("importing-card")).toHaveLength(2);
    expect(screen.getAllByTestId("importing-card")[0]).toHaveAttribute("data-variant", "list");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(mocks.retry).toHaveBeenCalledWith([failed]);
  });

  it("shows an empty state that points back to the dashboard", () => {
    render(<BulkImageImport />);

    expect(screen.getByText("emptyTitle")).toBeInTheDocument();
    expect(screen.getByText("emptyHint")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "emptyAction" })).toHaveAttribute("href", "/");
    expect(screen.queryByTestId("importing-card")).not.toBeInTheDocument();
  });

  it("does not draw a local drop zone", () => {
    render(<BulkImageImport />);

    expect(screen.queryByTestId("bulk-image-input")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "importButton" })).not.toBeInTheDocument();
  });

  it("keeps the AI-disabled message and the back link", () => {
    mocks.isAIEnabled = false;

    render(<BulkImageImport />);

    expect(screen.getByText("aiDisabled")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "backToRecipes" })).toHaveAttribute("href", "/");
  });
});
