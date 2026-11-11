"use client";

import { SettingsCardsSkeleton } from "@/components/settings/settings-skeleton";
import { BookOpenIcon, CircleStackIcon } from "@heroicons/react/24/outline";

export default function IngredientsSkeleton() {
  return (
    <SettingsCardsSkeleton
      cards={[
        { icon: BookOpenIcon, section: "ingredients", description: true, rows: 6 },
        { icon: CircleStackIcon, section: "ingredients.dataSources", rows: 2 },
      ]}
    />
  );
}
