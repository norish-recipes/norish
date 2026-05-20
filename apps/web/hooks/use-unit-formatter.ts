"use client";

import { useLocale } from "next-intl";
import { useUnitFormatter as useSharedUnitFormatter } from "@norish/shared-react/hooks";

import { useUnitsQuery } from "@/hooks/config/use-units-query";

export function useUnitFormatter() {
  const locale = useLocale();
  const { units } = useUnitsQuery();

  return useSharedUnitFormatter({ locale, units });
}
