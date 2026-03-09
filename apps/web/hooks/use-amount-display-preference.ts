"use client";

import { useLocalStorage } from "@/hooks/use-local-storage";

import { createUseAmountDisplayPreference } from "@norish/shared-react/hooks";

export const useAmountDisplayPreference = createUseAmountDisplayPreference({
  useStorage: useLocalStorage,
});
