import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@heroui/react", () => ({
  Image: ({ alt, className, onError, src }: any) => (
    <img alt={alt} className={className} src={src} onError={onError} />
  ),
}));

import { PlannedItemThumbnail } from "@/components/calendar/planned-item-thumbnail";

describe("PlannedItemThumbnail", () => {
  it("renders note placeholder for note items", () => {
    render(<PlannedItemThumbnail itemType="note" />);

    expect(screen.getByText("note")).toBeInTheDocument();
  });

  it("renders recipe placeholder when recipe has no image", () => {
    render(<PlannedItemThumbnail itemType="recipe" />);

    expect(screen.getByText("recipe")).toBeInTheDocument();
  });

  it("falls back to recipe placeholder when image fails to load", () => {
    render(<PlannedItemThumbnail alt="Baked Pasta" image="/broken.jpg" itemType="recipe" />);

    const image = screen.getByRole("img", { name: "Baked Pasta" });

    fireEvent.error(image);

    expect(screen.getByText("recipe")).toBeInTheDocument();
  });
});
