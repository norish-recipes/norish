"use client";

import { UserSettingsProvider } from "../context";
import AllergiesCard from "./allergies-card";
import ApiTokenCard from "./api-token-card";
import ArchiveImportCard from "./archive-import-card";
import DangerZoneCard from "./danger-zone-card";
import PreferencesCard from "./preferences-card";
import ProfileCard from "./profile-card";
import ShareLinksCard from "./share-links-card";
import SiteAuthTokensCard from "./site-auth-tokens-card";

function UserSettingsContent() {
  return (
    <div className="flex w-full flex-col gap-6">
      <ProfileCard />
      <PreferencesCard />
      <AllergiesCard />
      <ApiTokenCard />
      <ShareLinksCard />
      <SiteAuthTokensCard />
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
