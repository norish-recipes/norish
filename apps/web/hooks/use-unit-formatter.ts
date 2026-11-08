"use client";

import { useUnitsQuery } from "@/hooks/config/use-units-query";
import { useLocale } from "next-intl";

import { createUnitFormatter } from "@norish/shared-react/hooks";
import { useDevicePreference } from "@norish/shared-react/reader";

export function useUnitFormatter() {
  const locale = useLocale();
  const { units } = useUnitsQuery();
  const [unitStyle] = useDevicePreference("unitStyle");

  return createUnitFormatter({ locale, units, unitStyle });
}
