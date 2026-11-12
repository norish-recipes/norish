"use client";

import { useEffect, useRef } from "react";

import { usePrefetchRecipe } from "@norish/shared-react/recipes";

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
  const prefetchRecipe = usePrefetchRecipe();
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
            prefetchRecipe(recipeId);
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
  }, [enabled, recipeId, prefetchRecipe]);

  return elementRef;
}
