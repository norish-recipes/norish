"use client";

import { useArchiveImportProgress } from "@norish/shared-react/recipes";

import AllergiesCard from "./components/allergies-card";
import ApiTokenCard from "./components/api-token-card";
import ArchiveExportCard from "./components/archive-export-card";
import ArchiveImportCard from "./components/archive-import-card";
import DangerZoneCard from "./components/danger-zone-card";
import PreferencesCard from "./components/preferences-card";
import ProfileCard from "./components/profile-card";
import ShareLinksCard from "./components/share-links-card";
import SignInMethodsCard from "./components/sign-in-methods-card";
import SiteAuthTokensCard from "./components/site-auth-tokens-card";

/** The Account: the Reader's profile, sign-in, preferences, keys, tokens and archive. */
export function AccountScreen() {
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
