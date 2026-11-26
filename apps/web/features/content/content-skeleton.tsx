"use client";

import { useParams } from "next/navigation";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsCardsSkeleton, SkeletonRows } from "@/components/settings/settings-skeleton";
import { BookOpenIcon, CircleStackIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { ContentList } from "./content-lists";
import { DEFAULT_CONTENT_LIST, isContentList, LIST_ICONS } from "./content-lists";
import { ContentLayout } from "./content-nav";

/** A list of Tags, Cuisines or Categories while it loads: its card, the search field and grey rows. */
export function EntryListSkeleton({ list }: { list: ContentList }) {
  const t = useTranslations("settings.content");

  return (
    <SettingsCard
      aria-busy
      data-testid="content-loading"
      icon={LIST_ICONS[list]}
      title={t(`lists.${list}`)}
    >
      <Skeleton className="h-10 w-full rounded-xl" />
      <SkeletonRows count={7} />
    </SettingsCard>
  );
}

/** The Ingredients list while it loads: its card and the Data sources card. */
function IngredientsSkeleton() {
  return (
    <SettingsCardsSkeleton
      cards={[
        { icon: BookOpenIcon, section: "ingredients", rows: 6 },
        { icon: CircleStackIcon, section: "ingredients.dataSources", rows: 2 },
      ]}
    />
  );
}

/** The Content tab while a list loads: the list picker and the card of the list the address names. */
export default function ContentSkeleton() {
  const { list } = useParams<{ list?: string }>();
  const shown = list && isContentList(list) ? list : DEFAULT_CONTENT_LIST;

  return (
    <ContentLayout nav={<Skeleton className="h-12 w-full rounded-xl md:h-56" />}>
      {shown === "ingredients" ? <IngredientsSkeleton /> : <EntryListSkeleton list={shown} />}
    </ContentLayout>
  );
}
