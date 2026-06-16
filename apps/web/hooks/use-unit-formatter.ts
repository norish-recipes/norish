"use client";

import { useUnitsQuery } from "@/hooks/config/use-units-query";
import { useLocale } from "next-intl";

import { useUnitFormatter as useSharedUnitFormatter } from "@norish/shared-react/hooks";

export function useUnitFormatter() {
  const locale = useLocale();
  const { units } = useUnitsQuery();

  return useSharedUnitFormatter({ locale, units });
}
