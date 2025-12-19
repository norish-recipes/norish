import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function createTestWrapper(queryClient: QueryClient) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

export function createMockAverageRatingData(
  recipeId: string,
  averageRating: number | null = null,
  ratingCount: number = 0
) {
  return { recipeId, averageRating, ratingCount };
}

export function createMockUserRatingData(recipeId: string, userRating: number | null = null) {
  return { recipeId, userRating };
}
