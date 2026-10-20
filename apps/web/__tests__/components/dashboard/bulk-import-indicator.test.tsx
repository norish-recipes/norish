import type { ReactNode } from "react";
import BulkImportIndicator from "@/components/dashboard/bulk-import-indicator";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeCount: 0,
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/context/bulk-import-context", () => ({
  useBulkImport: () => ({ activeCount: mocks.activeCount }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    key === "activeImports" ? `${values?.count ?? 0} images importing` : key,
}));

vi.mock("@heroui/react", () => ({
  Button: ({
    children,
    onPress,
    "aria-label": ariaLabel,
    "data-testid": testId,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    "aria-label"?: string;
    "data-testid"?: string;
  }) => (
    <button aria-label={ariaLabel} data-testid={testId} type="button" onClick={onPress}>
      {children}
    </button>
  ),
}));

beforeEach(() => {
  mocks.activeCount = 0;
  mocks.push.mockClear();
});

describe("BulkImportIndicator", () => {
  it("draws the count above the Add button and opens the batch page", () => {
    mocks.activeCount = 3;

    render(<BulkImportIndicator />);

    const bubble = screen.getByTestId("bulk-import-count");

    expect(bubble).toHaveTextContent("3");
    expect(bubble).toHaveAccessibleName("3 images importing");

    fireEvent.click(bubble);

    expect(mocks.push).toHaveBeenCalledWith("/recipes/import");
  });

  it("draws nothing when no image is in flight", () => {
    render(<BulkImportIndicator />);

    expect(screen.queryByTestId("bulk-import-count")).not.toBeInTheDocument();
  });
});
