import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { UnsavedChangesChip } from "@/app/(app)/settings/admin/components/unsaved-changes-chip";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => (key === "unsavedChanges" ? "Unsaved changes" : key),
}));

vi.mock("@heroui/react", () => ({
  Chip: ({ children, color, size, variant }: any) => (
    <div data-color={color} data-size={size} data-variant={variant}>
      {children}
    </div>
  ),
}));

describe("UnsavedChangesChip", () => {
  it("renders translated unsaved changes text", () => {
    render(<UnsavedChangesChip />);

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("uses warning flat small chip style", () => {
    const { container } = render(<UnsavedChangesChip />);
    const chip = container.firstElementChild;

    expect(chip).toHaveAttribute("data-color", "warning");
    expect(chip).toHaveAttribute("data-size", "sm");
    expect(chip).toHaveAttribute("data-variant", "flat");
  });
});
