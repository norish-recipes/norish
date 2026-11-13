"use client";

import { SettingsCardsSkeleton } from "@/components/settings/settings-skeleton";
import { ClipboardDocumentIcon, HomeIcon, UserGroupIcon } from "@heroicons/react/24/outline";

import type { HouseholdShape } from "../household-shape";

export default function HouseholdSkeleton({ shape }: { shape: HouseholdShape }) {
  // Without a household, its two cards sit side by side.
  if (shape === "none") {
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
        ...(shape === "admin"
          ? [{ icon: ClipboardDocumentIcon, section: "household.joinCode", rows: 2 }]
          : []),
      ]}
    />
  );
}
