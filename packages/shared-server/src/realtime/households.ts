import type { z } from "zod";

import type { TypedRedisEmitter } from "@norish/shared-server/redis/pubsub";
import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";
import { createTypedEmitter } from "@norish/shared-server/redis/pubsub";
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

export type HouseholdUserInfo = z.infer<typeof HouseholdUserJoinedEventSchema>["user"];

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

declare global {
  var __householdEmitter__: TypedRedisEmitter<HouseholdSubscriptionEvents> | undefined;
}

export const householdEmitter: TypedRedisEmitter<HouseholdSubscriptionEvents> =
  globalThis.__householdEmitter__ ||
  (globalThis.__householdEmitter__ = createTypedEmitter<HouseholdSubscriptionEvents>("household"));
