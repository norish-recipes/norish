"use client";

import { createUseAmountDisplayPreference } from "@norish/shared-react/hooks";

import { useLocalStorage } from "@/hooks/use-local-storage";


export const useAmountDisplayPreference = createUseAmountDisplayPreference({
  useStorage: useLocalStorage,
});
