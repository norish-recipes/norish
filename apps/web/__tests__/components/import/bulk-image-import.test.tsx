import type { BulkImportTrackerItem } from "@/context/bulk-import-state";
import type { ReactNode } from "react";
import BulkImageImport from "@/components/import/bulk-image-import";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageImportBatchDTO } from "@norish/shared/contracts";

const mocks = vi.hoisted(() => ({
  batch: null as ImageImportBatchDTO | null,
  items: [] as BulkImportTrackerItem[],
  retry: vi.fn(),
  clearBatch: vi.fn(),
  isAIEnabled: true,
}));

vi.mock("@/context/bulk-import-context", () => ({
  useBulkImport: () => ({
    batch: mocks.batch,
    items: mocks.items,
    retry: mocks.retry,
    clearBatch: mocks.clearBatch,
  }),
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
  }: {
    item: BulkImportTrackerItem;
    variant: string;
    onRetry: (items: readonly BulkImportTrackerItem[]) => void;
  }) => (
    <div data-testid="importing-card" data-variant={variant}>
      {item.filename}
    </div>
  ),
}));

vi.mock("@heroui/react", () => ({
  Button: ({ children, onPress }: { children?: ReactNode; onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
}));

function batchItem(
  overrides: Partial<ImageImportBatchDTO["items"][number]> & {
    itemId: string;
    position: number;
  }
): ImageImportBatchDTO["items"][number] {
  return {
    filename: `page-${overrides.position}.png`,
    status: "done",
    errorCode: null,
    recipeId: null,
    retryable: false,
    ...overrides,
  };
}

function trackerItem(overrides: Partial<BulkImportTrackerItem> = {}): BulkImportTrackerItem {
  return {
    itemId: "item-0",
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
  mocks.batch = null;
  mocks.items = [];
  mocks.retry.mockReset();
  mocks.clearBatch.mockReset();
  mocks.isAIEnabled = true;
});

describe("BulkImageImport", () => {
  it("draws every batch item with a status, recipe link, retry, and clear", () => {
    const failed = batchItem({
      itemId: "item-1",
      position: 1,
      filename: "failed.png",
      status: "failed",
      errorCode: "extraction-failed",
      retryable: true,
    });

    mocks.batch = {
      batchId: "batch-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      items: [
        batchItem({
          itemId: "item-0",
          position: 0,
          filename: "done.png",
          status: "done",
          recipeId: "recipe-1",
        }),
        failed,
        batchItem({
          itemId: "item-2",
          position: 2,
          filename: "open.png",
          status: "processing",
        }),
      ],
    };

    render(<BulkImageImport />);

    expect(screen.getByText("done.png")).toBeInTheDocument();
    expect(screen.getByText("failed.png")).toBeInTheDocument();
    expect(screen.getByText("open.png")).toBeInTheDocument();
    expect(screen.getByText("status.done")).toBeInTheDocument();
    expect(screen.getByText("status.failed")).toBeInTheDocument();
    expect(screen.getByText("status.processing")).toBeInTheDocument();
    expect(screen.getByText("error.extraction-failed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "openRecipe" })).toHaveAttribute(
      "href",
      "/recipes/recipe-1"
    );
    expect(screen.getAllByRole("link", { name: "openRecipe" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "retry" }));

    expect(mocks.retry).toHaveBeenCalledWith([failed]);

    fireEvent.click(screen.getByRole("button", { name: "clear" }));

    expect(mocks.clearBatch).toHaveBeenCalled();
  });

  it("draws the active tracker cards before the batch status arrives", () => {
    mocks.items = [trackerItem()];

    render(<BulkImageImport />);

    expect(screen.getByTestId("importing-card")).toHaveAttribute("data-variant", "list");
    expect(screen.getByText("page.png")).toBeInTheDocument();
    expect(screen.queryByText("emptyTitle")).not.toBeInTheDocument();
  });

  it("shows an empty state that points back to the dashboard", () => {
    render(<BulkImageImport />);

    expect(screen.getByText("emptyTitle")).toBeInTheDocument();
    expect(screen.getByText("emptyHint")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "emptyAction" })).toHaveAttribute("href", "/");
    expect(screen.queryByTestId("importing-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bulk-image-input")).not.toBeInTheDocument();
  });

  it("keeps the AI-disabled message and the back link", () => {
    mocks.isAIEnabled = false;

    render(<BulkImageImport />);

    expect(screen.getByText("aiDisabled")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "backToRecipes" })).toHaveAttribute("href", "/");
  });
});
