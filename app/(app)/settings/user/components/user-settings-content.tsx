"use client";

import { UserSettingsProvider } from "../context";

import ProfileCard from "./profile-card";
import AllergiesCard from "./allergies-card";
import ApiTokenCard from "./api-token-card";
import ArchiveImportCard from "./archive-import-card";
import DangerZoneCard from "./danger-zone-card";

function UserSettingsContent() {
  return (
    <div className="flex w-full flex-col gap-6">
      <ProfileCard />
      <AllergiesCard />
      <ApiTokenCard />
      <ArchiveImportCard />
      <DangerZoneCard />
    </div>
  );
}

export default function UserSettingsContentWrapper() {
  return (
    <UserSettingsProvider>
      <UserSettingsContent />
    </UserSettingsProvider>
  );
}
