import type { z } from "zod";

import type {
  HouseholdAdminSettingsSchema,
  HouseholdInsertBaseSchema,
  HouseholdSelectBaseSchema,
  HouseholdSettingsSchema,
  HouseholdUpdateBaseSchema,
  HouseholdUserInsertBaseSchema,
  HouseholdUserSelectBaseSchema,
  HouseholdWithUsersNamesSchema,
} from "@norish/shared/contracts/zod/household";

export type HouseholdDto = z.output<typeof HouseholdSelectBaseSchema>;
export type HouseholdInsertDto = z.input<typeof HouseholdInsertBaseSchema>;
export type HouseholdUpdateDto = z.input<typeof HouseholdUpdateBaseSchema>;

export type HouseholdUserDto = z.output<typeof HouseholdUserSelectBaseSchema>;
export type HouseholdUserInsertDto = z.input<typeof HouseholdUserInsertBaseSchema>;

export type HouseholdWithUsersNamesDto = z.output<typeof HouseholdWithUsersNamesSchema>;
export type HouseholdSettingsDto = z.output<typeof HouseholdSettingsSchema>;
export type HouseholdAdminSettingsDto = z.output<typeof HouseholdAdminSettingsSchema>;
