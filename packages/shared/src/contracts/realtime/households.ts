/**
 * Household realtime catalogue: the first domain whose payloads are validated
 * at runtime by the zod schemas that always described them.
 *
 * `created`, `userKicked`, `userLeft` and `failed` go to one user; the rest go
 * to the household. `userLeft` is user-scoped because it is announced to each
 * remaining member individually after the leaver's membership is gone.
 */

import { z } from "zod";

import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";
import {
  HouseholdAdminTransferredEventSchema,
  HouseholdAllergiesUpdatedEventSchema,
  HouseholdFailedEventSchema,
  HouseholdJoinCodeRegeneratedEventSchema,
  HouseholdMemberProfileUpdatedEventSchema,
  HouseholdMemberRemovedEventSchema,
  HouseholdUserJoinedEventSchema,
  HouseholdUserKickedEventSchema,
  HouseholdUserLeftEventSchema,
} from "@norish/shared/contracts/zod/household";

import { defineRealtimeCatalogue } from "./catalogue";

export type HouseholdUserInfo = z.infer<typeof HouseholdUserJoinedEventSchema>["user"];

export const householdsRealtime = defineRealtimeCatalogue("household", {
  // z.custom: HouseholdSettingsDto | HouseholdAdminSettingsDto is a union of two drizzle-derived views.
  created: {
    scope: "user",
    payload: z.custom<{ household: HouseholdSettingsDto | HouseholdAdminSettingsDto }>(),
  },
  userJoined: { scope: "household", payload: HouseholdUserJoinedEventSchema },
  userLeft: { scope: "user", payload: HouseholdUserLeftEventSchema },
  userKicked: { scope: "user", payload: HouseholdUserKickedEventSchema },
  memberRemoved: { scope: "household", payload: HouseholdMemberRemovedEventSchema },
  adminTransferred: { scope: "household", payload: HouseholdAdminTransferredEventSchema },
  joinCodeRegenerated: { scope: "household", payload: HouseholdJoinCodeRegeneratedEventSchema },
  allergiesUpdated: { scope: "household", payload: HouseholdAllergiesUpdatedEventSchema },
  memberProfileUpdated: { scope: "household", payload: HouseholdMemberProfileUpdatedEventSchema },
  failed: { scope: "user", payload: HouseholdFailedEventSchema },
});

export type HouseholdsRealtime = typeof householdsRealtime;
