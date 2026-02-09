import type { PlannedRecipeViewDto, NoteViewDto, CalendarItemViewDto, Slot } from "@/types";
import type { ReactNode } from "react";
import type { CalendarData } from "@/hooks/calendar/use-calendar-query";

import { vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";

/**
 * Create a test QueryClient with optimized settings for tests
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Mock tRPC client for calendar testing
 */
export function createMockTrpcClient() {
  return {
    calendar: {
      listRecipes: {
        queryKey: vi.fn((input) => ["calendar", "listRecipes", input]),
        queryOptions: vi.fn(() => ({
          queryKey: ["calendar", "listRecipes"],
          queryFn: vi.fn(),
        })),
      },
      listNotes: {
        queryKey: vi.fn((input) => ["calendar", "listNotes", input]),
        queryOptions: vi.fn(() => ({
          queryKey: ["calendar", "listNotes"],
          queryFn: vi.fn(),
        })),
      },
      createRecipe: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      deleteRecipe: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      updateRecipeDate: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      createNote: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      deleteNote: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      updateNoteDate: {
        mutationOptions: vi.fn(() => ({
          mutationFn: vi.fn(),
        })),
      },
      onRecipePlanned: {
        subscriptionOptions: vi.fn(),
      },
      onRecipeDeleted: {
        subscriptionOptions: vi.fn(),
      },
      onRecipeUpdated: {
        subscriptionOptions: vi.fn(),
      },
      onNotePlanned: {
        subscriptionOptions: vi.fn(),
      },
      onNoteDeleted: {
        subscriptionOptions: vi.fn(),
      },
      onNoteUpdated: {
        subscriptionOptions: vi.fn(),
      },
      onFailed: {
        subscriptionOptions: vi.fn(),
      },
    },
  };
}

/**
 * Create wrapper with providers for testing hooks
 */
export function createTestWrapper(queryClient: QueryClient) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/**
 * Helper to render a hook with all necessary providers
 */
export function renderHookWithProviders<TResult>(
  hook: () => TResult,
  options?: {
    queryClient?: QueryClient;
    initialRecipes?: PlannedRecipeViewDto[];
    initialNotes?: NoteViewDto[];
  }
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();

  if (options?.initialRecipes) {
    queryClient.setQueryData(["calendar", "listRecipes"], options.initialRecipes);
  }
  if (options?.initialNotes) {
    queryClient.setQueryData(["calendar", "listNotes"], options.initialNotes);
  }

  return {
    ...renderHook(hook, { wrapper: createTestWrapper(queryClient) }),
    queryClient,
  };
}

/**
 * Create mock planned recipe for testing
 */
export function createMockPlannedRecipe(
  overrides: Partial<PlannedRecipeViewDto> = {}
): PlannedRecipeViewDto {
  return {
    id: `pr-${Math.random().toString(36).slice(2)}`,
    recipeId: "recipe-123",
    recipeName: "Test Recipe",
    recipeImage: null,
    servings: 1,
    calories: 100,
    date: "2025-01-15",
    slot: "Breakfast" as Slot,
    ...overrides,
  };
}

/**
 * Create mock note for testing
 */
export function createMockNote(overrides: Partial<NoteViewDto> = {}): NoteViewDto {
  return {
    id: `note-${Math.random().toString(36).slice(2)}`,
    title: "Test Note",
    date: "2025-01-15",
    slot: "Lunch" as Slot,
    recipeId: null,
    ...overrides,
  };
}

/**
 * Create mock calendar item (recipe type)
 */
export function createMockRecipeItem(
  overrides: Partial<CalendarItemViewDto & { itemType: "recipe" }> = {}
): CalendarItemViewDto {
  return {
    itemType: "recipe",
    id: `pr-${Math.random().toString(36).slice(2)}`,
    recipeId: "recipe-123",
    recipeName: "Test Recipe",
    recipeImage: null,
    servings: 1,
    calories: 100,
    date: "2025-01-15",
    slot: "Breakfast" as Slot,
    ...overrides,
  } as CalendarItemViewDto;
}

/**
 * Create mock calendar item (note type)
 */
export function createMockNoteItem(
  overrides: Partial<CalendarItemViewDto & { itemType: "note" }> = {}
): CalendarItemViewDto {
  return {
    itemType: "note",
    id: `note-${Math.random().toString(36).slice(2)}`,
    title: "Test Note",
    date: "2025-01-15",
    slot: "Lunch" as Slot,
    recipeId: null,
    ...overrides,
  } as CalendarItemViewDto;
}

/**
 * Create mock calendar data (date-grouped)
 */
export function createMockCalendarData(
  items: { date: string; items: CalendarItemViewDto[] }[] = []
): CalendarData {
  const data: CalendarData = {};

  for (const { date, items: dateItems } of items) {
    data[date] = dateItems;
  }

  return data;
}
