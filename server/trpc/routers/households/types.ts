import type { HouseholdSettingsDto, HouseholdAdminSettingsDto } from "@/types/dto/household";

// User info for events
export type HouseholdUserInfo = {
  id: string;
  name: string | null;
  isAdmin: boolean;
};

// Event payloads
export type HouseholdSubscriptionEvents = {
  created: {
    household: HouseholdSettingsDto | HouseholdAdminSettingsDto;
  };
  userJoined: {
    user: HouseholdUserInfo;
  };
  userLeft: {
    userId: string;
  };
  userKicked: {
    householdId: string;
    kickedBy: string;
  };
  memberRemoved: {
    userId: string;
  };
  adminTransferred: {
    oldAdminId: string;
    newAdminId: string;
  };
  joinCodeRegenerated: {
    joinCode: string;
    joinCodeExpiresAt: string;
  };
  allergiesUpdated: {
    allergies: string[];
  };
  failed: {
    reason: string;
  };
};
