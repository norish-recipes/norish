import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { CalendarRangeProvider } from "../calendar-range-store";
import { useCalendarMutations } from "../use-calendar-mutations";
import { useCalendarRangeQuery } from "../use-calendar-range-query";

type Range = { startISO: string; endISO: string };

const PLAN: PlannedItemFromQuery = {
  id: "soup",
  userId: "u1",
  date: "2026-11-12",
  slot: "Dinner",
  sortOrder: 0,
  itemType: "note",
  recipeId: null,
  title: "Soup",
  recipeName: null,
  recipeImage: null,
  servings: null,
  calories: null,
  version: 1,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const FAR = "2026-12-24";

const listKey = (input?: Range) =>
  input ? [["calendar", "listItems"], { input, type: "query" }] : [["calendar", "listItems"]];
// The server: the plan sits where the last move put it.
const server = { date: PLAN.date, version: 1 };

vi.mock("../../trpc", () => ({
  useTRPC: () => ({
    calendar: {
      listItems: {
        queryKey: listKey,
        queryOptions: (input: Range) => ({
          queryKey: listKey(input),
          queryFn: async () =>
            server.date >= input.startISO && server.date <= input.endISO
              ? [{ ...PLAN, ...server }]
              : [],
        }),
      },
      moveItem: {
        mutationOptions: (options: object) => ({
          ...options,
          mutationFn: async (input: { targetDate: string }) => {
            Object.assign(server, { date: input.targetDate, version: 2 });

            return { success: true, moved: true, stale: false, item: { ...PLAN, ...server } };
          },
        }),
      },
      createItem: { mutationOptions: (options: object) => options },
      deleteItem: { mutationOptions: (options: object) => options },
      updateItem: { mutationOptions: (options: object) => options },
    },
  }),
}));

describe("a plan moved past the range's edge", () => {
  it("stays on show once the range reaches its new day", async () => {
    const Providers = createTestWrapper(createTestQueryClient());
    const { result } = renderHook(
      () => ({ ...useCalendarRangeQuery(), ...useCalendarMutations() }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <Providers>
            <CalendarRangeProvider today="2026-11-11">{children}</CalendarRangeProvider>
          </Providers>
        ),
      }
    );

    await waitFor(() => expect(result.current.calendarData[PLAN.date]).toHaveLength(1));
    act(() => {
      result.current.reach(FAR);
      result.current.moveItem(PLAN.id, FAR, "Dinner");
    });

    expect(result.current.calendarData[FAR]?.map(({ id }) => id)).toEqual([PLAN.id]);
    await waitFor(() => expect(result.current.calendarData[FAR]?.[0]?.version).toBe(2));
  });
});
