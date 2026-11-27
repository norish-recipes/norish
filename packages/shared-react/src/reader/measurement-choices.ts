import type { MeasurementSystemChoice } from "@norish/shared/lib/user-preferences";
import { MEASUREMENT_SYSTEM_CHOICES } from "@norish/shared/contracts/zod/user";
import { measurementSystemTarget } from "@norish/shared/lib/user-preferences";

/** Converting with AI is on offer only where an administrator has AI on. */
export const measurementChoices = (aiEnabled: boolean): readonly MeasurementSystemChoice[] =>
  aiEnabled
    ? MEASUREMENT_SYSTEM_CHOICES
    : MEASUREMENT_SYSTEM_CHOICES.filter((choice) => !measurementSystemTarget(choice)?.withAI);

/** A choice of AI made before it was switched off reads as the same system without. */
export const shownMeasurement = (
  stored: MeasurementSystemChoice,
  aiEnabled: boolean
): MeasurementSystemChoice =>
  aiEnabled ? stored : (measurementSystemTarget(stored)?.system ?? "off");
