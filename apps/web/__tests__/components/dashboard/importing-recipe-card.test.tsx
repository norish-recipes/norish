import type { BulkImportTrackerItem } from "@/context/bulk-import-state";
import type { ReactNode } from "react";
import ImportingRecipeCard from "@/components/dashboard/importing-recipe-card";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const STATUS_TEXT: Record<string, string> = {
  "status.queued": "Queued",
  "status.processing": "Reading image",
  "status.done": "Recipe created",
  "error.extraction-failed": "Norish could not read a recipe from this image.",
  retry: "Retry",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => STATUS_TEXT[key] ?? key,
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string } & Record<string, unknown>) => (
    <img alt={alt} src={src} />
  ),
}));

vi.mock("@heroicons/react/16/solid", () => ({
  ArrowPathIcon: () => <span />,
}));

vi.mock("@heroicons/react/24/outline", () => ({
  PhotoIcon: () => <span data-testid="placeholder-icon" />,
}));

vi.mock("@heroui/react", () => ({
  Button: ({ children, onPress }: { children?: ReactNode; onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  Card: Object.assign(
    ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => (
      <article {...props}>{children}</article>
    ),
    {
      Content: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => (
        <div {...props}>{children}</div>
      ),
    }
  ),
}));

function item(overrides: Partial<BulkImportTrackerItem> = {}): BulkImportTrackerItem {
  return {
    itemId: "item-1",
    position: 0,
    filename: "page.png",
    status: "queued",
    recipeId: null,
    errorCode: null,
    previewUrl: "blob:page.png",
    ...overrides,
  };
}

describe("ImportingRecipeCard", () => {
  it("draws the preview, filename, and queued status", () => {
    const { container } = render(
      <ImportingRecipeCard item={item()} variant="grid" onRetry={vi.fn()} />
    );

    expect(screen.getByTestId("importing-recipe-card")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "blob:page.png");
    expect(screen.getByText("page.png")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it("shows that the image is being read", () => {
    render(
      <ImportingRecipeCard item={item({ status: "processing" })} variant="list" onRetry={vi.fn()} />
    );

    expect(screen.getByText("Reading image")).toBeInTheDocument();
  });

  it("draws a placeholder after a reload dropped the preview", () => {
    render(
      <ImportingRecipeCard item={item({ previewUrl: null })} variant="grid" onRetry={vi.fn()} />
    );

    expect(screen.getByTestId("placeholder-icon")).toBeInTheDocument();
  });

  it("draws a failed card with a retry for that item", () => {
    const onRetry = vi.fn();
    const failed = item({ status: "failed", errorCode: "extraction-failed" });

    render(<ImportingRecipeCard item={failed} variant="grid" onRetry={onRetry} />);

    expect(screen.getByText("Norish could not read a recipe from this image.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledWith([failed]);
  });
});
