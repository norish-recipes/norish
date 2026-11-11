"use client";

import type { HouseholdShape } from "@/components/settings/settings-tab";
import { SettingsCardsSkeleton } from "@/components/settings/settings-skeleton";
import { ClipboardDocumentIcon, HomeIcon, UserGroupIcon } from "@heroicons/react/24/outline";

export default function HouseholdSkeleton({ household }: { household: HouseholdShape }) {
  // Without a household, its two cards sit side by side.
  if (household === "none") {
    return (
      <SettingsCardsSkeleton
        sideBySide
        cards={[
          { icon: HomeIcon, section: "household.create", description: true, rows: 2 },
          { icon: UserGroupIcon, section: "household.join", description: true, rows: 2 },
        ]}
      />
    );
  }

  return (
    <SettingsCardsSkeleton
      cards={[
        // The household's name is its title.
        { icon: HomeIcon, rows: 3 },
        { icon: UserGroupIcon, section: "household.members", rows: 2 },
        ...(household === "admin"
          ? [{ icon: ClipboardDocumentIcon, section: "household.joinCode", rows: 2 }]
          : []),
      ]}
    />
  );
}
