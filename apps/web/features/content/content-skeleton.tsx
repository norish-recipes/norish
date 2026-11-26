"use client";

import { SettingsCardsSkeleton } from "@/components/settings/settings-skeleton";
import { TagIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@heroui/react";

import { ContentLayout } from "./content-nav";

/** The Content tab while a list loads: the list picker and a card of grey rows. */
export default function ContentSkeleton() {
  return (
    <ContentLayout
      nav={<Skeleton className="h-12 w-full rounded-xl md:h-56 md:w-60 md:shrink-0" />}
    >
      <SettingsCardsSkeleton cards={[{ icon: TagIcon, rows: 8 }]} />
    </ContentLayout>
  );
}
