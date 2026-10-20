import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { PlannedItemDisplay } from "@/components/calendar/mobile/types";
import { PlannedItemContent } from "@/components/calendar/mobile/planned-item-content";
import { EditPlannedRecipePanel } from "@/components/Panel/consumers/edit-planned-recipe-panel";

import { primaryRecipeImage } from "@norish/shared/lib/recipe-media";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children?: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/app/(app)/calendar/context", () => ({
  useCalendarContext: () => ({
    deletePlanned: vi.fn(),
    moveItem: vi.fn(),
    planMeal: vi.fn(),
  }),
}));

vi.mock("@/components/Panel/Panel", () => {
  const Section = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    Panel: Object.assign(Section, { Body: Section, Footer: Section }),
    usePanelPortalContainer: () => undefined,
  };
});

vi.mock("@/components/shared/action-button", () => ({
  ActionButton: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  ActionButtonGroup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@heroui/react", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  const DatePicker = Object.assign(Box, {
    Popover: Box,
    Trigger: Box,
    TriggerIndicator: Empty,
  });
  const DateField = Object.assign(Box, { Group: Box, Input: Empty, Segment: Empty, Suffix: Box });
  const Calendar = Object.assign(Box, {
    Cell: Empty,
    Grid: Box,
    GridBody: Empty,
    GridHeader: Empty,
    Header: Box,
    HeaderCell: Empty,
    NavButton: Empty,
    YearPickerCell: Empty,
    YearPickerGrid: Box,
    YearPickerGridBody: Empty,
    YearPickerTrigger: Box,
    YearPickerTriggerHeading: Empty,
    YearPickerTriggerIndicator: Empty,
  });
  const Select = Object.assign(Box, {
    Indicator: Empty,
    Popover: Box,
    Trigger: Box,
    Value: Empty,
  });
  const ListBox = Object.assign(Box, { Item: Box, ItemIndicator: Empty });

  return { Calendar, DateField, DatePicker, Label: Box, ListBox, Select };
});

const galleryOnlyRecipe = {
  image: null,
  images: [{ image: "/recipes/recipe-1/gallery.jpg", order: 0 }],
};

const plannedItem: PlannedItemDisplay = {
  id: "item-1",
  date: "2026-10-20",
  slot: "Dinner",
  sortOrder: 0,
  itemType: "recipe",
  recipeId: "recipe-1",
  recipeName: "Pasta",
  recipeImage: primaryRecipeImage(galleryOnlyRecipe),
  title: null,
  servings: 2,
  calories: 500,
};

describe("a planned recipe whose only image is in the gallery", () => {
  it("shows the gallery image on the schedule card", () => {
    render(<PlannedItemContent item={plannedItem} />);

    expect(screen.getByRole("img", { name: "Pasta" })).toHaveAttribute(
      "src",
      "/recipes/recipe-1/gallery.jpg"
    );
  });

  it("shows the gallery image in the planned recipe popup", () => {
    render(
      <EditPlannedRecipePanel
        date={plannedItem.date}
        itemId={plannedItem.id}
        open
        recipeId="recipe-1"
        recipeImage={plannedItem.recipeImage ?? null}
        recipeName="Pasta"
        slot="Dinner"
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByRole("img", { name: "Pasta" })).toHaveAttribute(
      "src",
      "/recipes/recipe-1/gallery.jpg"
    );
  });
});
