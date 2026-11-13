"use client";

import { useLocale } from "next-intl";

import { useUnitFormatter as useSharedUnitFormatter } from "@norish/shared-react/recipes";

export function useUnitFormatter() {
  return useSharedUnitFormatter(useLocale());
}
