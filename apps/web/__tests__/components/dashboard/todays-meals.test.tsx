import TodaysMeals from "@/components/dashboard/today/todays-meals";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import type { TodaySectionVisibility } from "@norish/shared/contracts/zod/device-preferences";
import { dateKey, getInitialDateRange } from "@norish/shared/lib/helpers";

const pushMock = vi.fn();
const useCalendarQueryMock = vi.fn();
const setVisibilityMock = vi.fn();

let visibilityMock: TodaySectionVisibility = "always";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@norish/shared-react/reader", async () =>
  (await import("../../helpers/reader-mock")).mockDevicePreferences(
    () => ({ todaySectionVisibility: visibilityMock }),
    { set: (_key, next) => setVisibilityMock(next) }
  )
);

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace?: string) => (key: string) => {
    const messages: Record<string, string> = {
      "calendar.mobile.today": "Today",
      "calendar.page.title": "Calendar",
      "calendar.timeline.untitled": "Untitled",
      "calendar.timeline.note": "Note",
      "calendar.timeline.serving": "serving",
      "calendar.timeline.servings": "servings",
      "calendar.timeline.noItems": "No items planned",
      "calendar.panel.addRecipe": "Add Recipe",
      "common.slots.breakfast": "Breakfast",
      "common.slots.lunch": "Lunch",
      "common.slots.dinner": "Dinner",
      "common.slots.snack": "Snack",
    };

    return messages[namespace ? `${namespace}.${key}` : key] ?? key;
  },
}));

vi.mock("@norish/shared-react/calendar", () => ({
  useCalendarQuery: (range: unknown) => useCalendarQueryMock(range),
  useCalendarSubscription: vi.fn(),
}));

vi.mock("@/components/Panel/consumers/mini-recipes", () => ({
  default: ({ open, slot }: { open: boolean; slot?: string }) =>
    open ? <div role="dialog">Mini recipes {slot}</div> : null,
}));

vi.mock("@heroui/react", () => ({
  Button: ({ children, onPress, ...props }: any) => (
    <button type="button" onClick={onPress} {...props}>
      {children}
    </button>
  ),
  Card: Object.assign(({ children, ...props }: any) => <article {...props}>{children}</article>, {
    Content: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Description: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    Title: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
  }),
  Chip: Object.assign(({ children, ...props }: any) => <span {...props}>{children}</span>, {
    Label: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  }),
  ScrollShadow: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Skeleton: (props: any) => <div {...props} />,
}));

function createPlannedItem(
  date: string,
  overrides: Partial<PlannedItemFromQuery> = {}
): PlannedItemFromQuery {
  return {
    id: "planned-1",
    userId: "user-1",
    date,
    slot: "Dinner",
    sortOrder: 0,
    itemType: "recipe",
    recipeId: "recipe-1",
    title: null,
    recipeName: "Pasta Night",
    recipeImage: "/recipes/pasta.jpg",
    servings: 4,
    calories: 640,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("TodaysMeals", () => {
  beforeEach(() => {
    pushMock.mockReset();
    useCalendarQueryMock.mockReset();
    visibilityMock = "always";
  });

  it("renders all meal slots and today's planned recipe", () => {
    const todayKey = dateKey(new Date());

    useCalendarQueryMock.mockReturnValue({
      calendarData: {
        [todayKey]: [createPlannedItem(todayKey)],
      },
      isLoading: false,
    });

    render(<TodaysMeals />);

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getAllByText("Breakfast")).not.toHaveLength(0);
    expect(screen.getAllByText("Lunch")).not.toHaveLength(0);
    expect(screen.getAllByText("Dinner")).not.toHaveLength(0);
    expect(screen.getAllByText("Snack")).not.toHaveLength(0);
    expect(screen.getByText("Pasta Night")).toBeInTheDocument();
    expect(screen.getByText("4 servings / 640 kcal")).toBeInTheDocument();

    // The week the dashboard layout seeds, so hydration reads the seeded copy.
    const week = getInitialDateRange("desktop", todayKey);

    expect(useCalendarQueryMock).toHaveBeenCalledWith({
      startISO: dateKey(week.start),
      endISO: dateKey(week.end),
    });
  });

  it("opens planned recipes directly and empty slots in mini recipes", () => {
    const todayKey = dateKey(new Date());

    useCalendarQueryMock.mockReturnValue({
      calendarData: {
        [todayKey]: [
          createPlannedItem(todayKey, { recipeId: "recipe-42", recipeName: "Pasta Night" }),
        ],
      },
      isLoading: false,
    });

    render(<TodaysMeals />);

    // A real link, so it opens in a new tab too (#555).
    expect(screen.getByRole("link", { name: "Pasta Night" })).toHaveAttribute(
      "href",
      "/recipes/recipe-42"
    );

    const emptyBreakfastButton = screen.getByRole("button", { name: "Add Recipe Breakfast" });

    expect(emptyBreakfastButton).toHaveTextContent("Add Recipe");

    fireEvent.click(emptyBreakfastButton);
    expect(pushMock).not.toHaveBeenCalledWith("/calendar");
    expect(screen.getByRole("dialog")).toHaveTextContent("Mini recipes Breakfast");
  });

  it("shows only slots with planned items in planned mode", () => {
    visibilityMock = "planned";
    const todayKey = dateKey(new Date());

    useCalendarQueryMock.mockReturnValue({
      calendarData: {
        [todayKey]: [createPlannedItem(todayKey, { slot: "Dinner" })],
      },
      isLoading: false,
    });

    render(<TodaysMeals />);

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getAllByText("Dinner")).not.toHaveLength(0);
    expect(screen.queryByText("Breakfast")).not.toBeInTheDocument();
    expect(screen.queryByText("Lunch")).not.toBeInTheDocument();
    expect(screen.queryByText("Snack")).not.toBeInTheDocument();
  });

  it("renders nothing in planned mode when nothing is planned", () => {
    visibilityMock = "planned";

    useCalendarQueryMock.mockReturnValue({
      calendarData: {},
      isLoading: false,
    });

    render(<TodaysMeals />);

    expect(screen.queryByRole("heading", { name: "Today" })).not.toBeInTheDocument();
  });

  it("renders nothing when hidden", () => {
    visibilityMock = "hidden";
    const todayKey = dateKey(new Date());

    useCalendarQueryMock.mockReturnValue({
      calendarData: {
        [todayKey]: [createPlannedItem(todayKey)],
      },
      isLoading: false,
    });

    render(<TodaysMeals />);

    expect(screen.queryByRole("heading", { name: "Today" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pasta Night")).not.toBeInTheDocument();
  });
});
