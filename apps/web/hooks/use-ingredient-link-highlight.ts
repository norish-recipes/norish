"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { IngredientLinkCandidate } from "@norish/shared-react/text";

type UseIngredientLinkHighlightOptions = {
  onBeforeHighlight?: (candidate: IngredientLinkCandidate) => void;
};

export function useIngredientLinkHighlight({
  onBeforeHighlight,
}: UseIngredientLinkHighlightOptions = {}) {
  const [highlightedIngredientKey, setHighlightedIngredientKey] = useState<string | null>(null);
  const ingredientListRef = useRef<HTMLUListElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const highlightIngredient = useCallback(
    (candidate: IngredientLinkCandidate) => {
      onBeforeHighlight?.(candidate);
      setHighlightedIngredientKey(candidate.key);

      window.setTimeout(() => {
        scrollIngredientIntoView(candidate.key, ingredientListRef.current);
      }, 50);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setHighlightedIngredientKey(null);
      }, 1800);
    },
    [onBeforeHighlight]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    highlightedIngredientKey,
    highlightIngredient,
    ingredientListRef,
  };
}

function scrollIngredientIntoView(key: string, root: HTMLElement | null) {
  const element = findIngredientElement(key, root);

  element?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function findIngredientElement(key: string, root: HTMLElement | null): HTMLElement | null {
  const scopedElement = findMatchingElement(root, key);

  if (scopedElement) {
    return scopedElement;
  }

  return findMatchingElement(document, key);
}

function findMatchingElement(root: Document | HTMLElement | null, key: string): HTMLElement | null {
  if (!root) {
    return null;
  }

  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>("[data-ingredient-link-key]")
  ).filter((candidate) => candidate.dataset.ingredientLinkKey === key);

  return candidates.find(isVisibleElement) ?? candidates[0] ?? null;
}

function isVisibleElement(element: HTMLElement): boolean {
  return element.getClientRects().length > 0;
}
