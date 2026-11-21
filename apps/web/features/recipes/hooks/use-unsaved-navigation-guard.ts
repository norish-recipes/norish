"use client";

import { useEffect, useEffectEvent } from "react";

import { useUnsavedNavigationGuard as useSharedGuard } from "@norish/shared-react/recipes";

interface UseUnsavedNavigationGuardOptions {
  hasUnsavedChanges: boolean;
  confirmationMessage: string;
  onConfirmLeave: () => void;
}

function isEditableBackspaceTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target.isContentEditable ||
    target.closest(
      '[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]'
    )
  ) {
    return true;
  }

  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/** The shared guard in a browser: asks with `confirm`, holds a reload or close and Backspace. */
export function useUnsavedNavigationGuard({
  hasUnsavedChanges,
  confirmationMessage,
  onConfirmLeave,
}: UseUnsavedNavigationGuardOptions) {
  const { allowNavigation, disallowNavigation, mustAsk, requestLeave } = useSharedGuard({
    hasUnsavedChanges,
    ask: (leave) => {
      if (window.confirm(confirmationMessage)) leave();
    },
  });

  const confirmNavigation = () => !mustAsk() || window.confirm(confirmationMessage);
  const handleBeforeUnload = useEffectEvent((event: BeforeUnloadEvent) => {
    if (mustAsk()) event.preventDefault();
  });
  const handleBackspace = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "Backspace" || isEditableBackspaceTarget(event.target)) return;

    event.preventDefault();
    requestLeave(onConfirmLeave);
  });

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleBackspace, { capture: true });

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleBackspace, { capture: true });
    };
  }, [hasUnsavedChanges]);

  return { allowNavigation, confirmNavigation, disallowNavigation };
}
