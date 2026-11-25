"use client";

import { SettingsCardsSkeleton } from "@/components/settings/settings-skeleton";
import { ClipboardDocumentIcon, HomeIcon, UserGroupIcon } from "@heroicons/react/24/outline";

import type { HouseholdShape } from "../household-shape";

export default function HouseholdSkeleton({ shape }: { shape: HouseholdShape }) {
  if (shape === "solo") {
    return (
      <SettingsCardsSkeleton
        cards={[
          { icon: HomeIcon, rows: 1 },
          { icon: ClipboardDocumentIcon, section: "household.joinCode", rows: 2 },
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
