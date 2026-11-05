"use client";

import { useDevicePreference } from "@/context/device-preferences-context";
import { useUnitsQuery } from "@/hooks/config/use-units-query";
import { useLocale } from "next-intl";

import { createUnitFormatter } from "@norish/shared-react/hooks";

export function useUnitFormatter() {
  const locale = useLocale();
  const { units } = useUnitsQuery();
  const [unitStyle] = useDevicePreference("unitStyle");

  return createUnitFormatter({ locale, units, unitStyle });
}
