import type { z } from "zod";

import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";
import {
  HouseholdAdminTransferredEventSchema,
  HouseholdAllergiesUpdatedEventSchema,
  HouseholdFailedEventSchema,
  HouseholdJoinCodeRegeneratedEventSchema,
  HouseholdMemberRemovedEventSchema,
  HouseholdUserJoinedEventSchema,
  HouseholdUserKickedEventSchema,
  HouseholdUserLeftEventSchema,
} from "@norish/shared/contracts/zod";

// User info for events
export type HouseholdUserInfo = z.infer<typeof HouseholdUserJoinedEventSchema>["user"];

// Event payloads
export type HouseholdSubscriptionEvents = {
  created: {
    household: HouseholdSettingsDto | HouseholdAdminSettingsDto;
  };
  userJoined: z.infer<typeof HouseholdUserJoinedEventSchema>;
  userLeft: z.infer<typeof HouseholdUserLeftEventSchema>;
  userKicked: z.infer<typeof HouseholdUserKickedEventSchema>;
  memberRemoved: z.infer<typeof HouseholdMemberRemovedEventSchema>;
  adminTransferred: z.infer<typeof HouseholdAdminTransferredEventSchema>;
  joinCodeRegenerated: z.infer<typeof HouseholdJoinCodeRegeneratedEventSchema>;
  allergiesUpdated: z.infer<typeof HouseholdAllergiesUpdatedEventSchema>;
  failed: z.infer<typeof HouseholdFailedEventSchema>;
};
