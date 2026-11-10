"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@norish/shared-react/trpc";

/**
 * Automatically prefetch recipe data when element comes into view.
 * Uses IntersectionObserver for efficient viewport detection.
 *
 * Can be used in recipe cards, calendar items, or any component that links to recipes.
 */
export function useRecipePrefetch<T extends HTMLElement = HTMLDivElement>(
  recipeId: string,
  enabled = true
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const elementRef = useRef<T>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled || !recipeId || typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Only trigger once when element enters viewport
          if (entry.isIntersecting && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            // A failed prefetch is fine: the data loads normally when the user clicks.
            queryClient.query(trpc.recipes.get.queryOptions({ id: recipeId })).catch(() => {});
          }
        });
      },
      {
        // Start prefetching when element is 200px before entering viewport
        rootMargin: "200px",
        threshold: 0,
      }
    );

    const element = elementRef.current;

    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
      observer.disconnect();
    };
  }, [enabled, recipeId, queryClient, trpc.recipes.get]);

  return elementRef;
}
