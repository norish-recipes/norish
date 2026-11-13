import { createUnitFormatter } from "@norish/shared/lib/unit-localization";

import { useUnitsQuery } from "../config";
import { useDevicePreference } from "../reader";

/** Writes amounts and units in `locale`, in the household's units and the device's unit style. */
export function useUnitFormatter(locale: string) {
  const { units } = useUnitsQuery();
  const [unitStyle] = useDevicePreference("unitStyle");

  return createUnitFormatter({ locale, units, unitStyle });
}
