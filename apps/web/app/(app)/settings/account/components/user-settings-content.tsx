"use client";

import { useArchiveImportProgress } from "@norish/shared-react/recipes";

import AllergiesCard from "./allergies-card";
import ApiTokenCard from "./api-token-card";
import ArchiveExportCard from "./archive-export-card";
import ArchiveImportCard from "./archive-import-card";
import DangerZoneCard from "./danger-zone-card";
import PreferencesCard from "./preferences-card";
import ProfileCard from "./profile-card";
import ShareLinksCard from "./share-links-card";
import SignInMethodsCard from "./sign-in-methods-card";
import SiteAuthTokensCard from "./site-auth-tokens-card";

export default function UserSettingsContent() {
  // The archive import's progress, drawn by its card; the shell applies its outcome.
  useArchiveImportProgress();

  return (
    <div className="flex w-full flex-col gap-6">
      <ProfileCard />
      <SignInMethodsCard />
      <PreferencesCard />
      <AllergiesCard />
      <ApiTokenCard />
      <ShareLinksCard />
      <SiteAuthTokensCard />
      <ArchiveImportCard />
      <ArchiveExportCard />
      <DangerZoneCard />
    </div>
  );
}
