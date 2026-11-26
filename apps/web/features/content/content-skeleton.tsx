"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton } from "@/components/shared/action-button";
import { ListFrame, ListRowSkeleton } from "@/components/shared/list-row";
import { Section } from "@/components/shared/section";
import { Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { EntryContentList, SectionTitle } from "@norish/shared-react/lists";
import { isContentList } from "@norish/shared-react/lists";

import { DEFAULT_CONTENT_LIST, LIST_ICONS } from "./content-lists";
import { ContentLayout } from "./content-nav";
import { ContentToolbar } from "./content-toolbar";

/** The sections a list loads into, as its loaded page has them: a heading over rows. */
const SECTIONS: Record<EntryContentList, { title: SectionTitle | null; rows: number }[]> = {
  tags: [{ title: null, rows: 6 }],
  cuisines: [
    { title: "ownCuisines", rows: 3 },
    { title: "server", rows: 3 },
  ],
  categories: [
    { title: "builtIn", rows: 4 },
    { title: "ownCategories", rows: 3 },
  ],
};

/**
 * A list of Tags, Cuisines or Categories while it loads: the loaded card with its toolbar, section
 * headings and rows, the controls off. The route and the list's own wait both draw it.
 */
export function EntryListSkeleton({ list }: { list: EntryContentList }) {
  const t = useTranslations("settings.content");
  const tActions = useTranslations("common.actions");

  return (
    <SettingsCard
      actions={
        <ActionButton action="add" isDisabled>
          {tActions("add")}
        </ActionButton>
      }
      aria-busy
      data-testid="content-loading"
      icon={LIST_ICONS[list]}
      title={t(`lists.${list}`)}
    >
      <ContentToolbar
        isDisabled
        list={list}
        search=""
        unusedOnly={false}
        onSearch={() => undefined}
        onUnusedOnly={() => undefined}
      />
      {SECTIONS[list].map(({ title, rows }) => (
        <Section
          key={title ?? list}
          placement="card"
          title={title ? t(`sections.${title}`) : undefined}
        >
          <ListFrame>
            {Array.from({ length: rows }, (_, row) => (
              <ListRowSkeleton key={row} />
            ))}
          </ListFrame>
        </Section>
      ))}
    </SettingsCard>
  );
}

/**
 * The Content tab while a list loads: the list picker and the card of the list the address names.
 * The route hands in the Ingredients skeleton, which another feature owns.
 */
export default function ContentSkeleton({ ingredients }: { ingredients: ReactNode }) {
  const { list } = useParams<{ list?: string }>();
  const shown = list && isContentList(list) ? list : DEFAULT_CONTENT_LIST;

  return (
    <ContentLayout nav={<Skeleton className="h-12 w-full rounded-xl md:h-56" />}>
      {shown === "ingredients" ? ingredients : <EntryListSkeleton list={shown} />}
    </ContentLayout>
  );
}
