"use client";

import { usePlatform } from "@norish/shared-react/platform";

export function useGroceriesErrorAdapter() {
  const { showError } = usePlatform();

  return {
    showErrorToast: (reason: string) => showError(reason, "groceries-subscription:onFailed"),
  };
}
