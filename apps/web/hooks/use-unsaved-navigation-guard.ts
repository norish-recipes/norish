"use client";

import { useCallback, useEffect, useRef } from "react";

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

export function useUnsavedNavigationGuard({
  hasUnsavedChanges,
  confirmationMessage,
  onConfirmLeave,
}: UseUnsavedNavigationGuardOptions) {
  const allowNavigationRef = useRef(false);

  const allowNavigation = useCallback(() => {
    allowNavigationRef.current = true;
  }, []);

  const disallowNavigation = useCallback(() => {
    allowNavigationRef.current = false;
  }, []);

  const confirmNavigation = useCallback(() => {
    if (!hasUnsavedChanges || allowNavigationRef.current) return true;

    return window.confirm(confirmationMessage);
  }, [confirmationMessage, hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBackspaceNavigation = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" || isEditableBackspaceTarget(event.target)) return;

      event.preventDefault();

      if (!confirmNavigation()) return;

      allowNavigation();
      onConfirmLeave();
    };

    window.addEventListener("keydown", handleBackspaceNavigation, { capture: true });

    return () =>
      window.removeEventListener("keydown", handleBackspaceNavigation, { capture: true });
  }, [allowNavigation, confirmNavigation, hasUnsavedChanges, onConfirmLeave]);

  return { allowNavigation, confirmNavigation, disallowNavigation };
}
