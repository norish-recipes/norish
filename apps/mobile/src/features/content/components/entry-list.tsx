import React from "react";
import { FlatList } from "react-native";
import { CardSlice } from "@/components/card-slice";
import { CountRow } from "@/components/count-row";
import { EmptyCard } from "@/components/empty-card";
import { ListHeading } from "@/components/list-heading";
import { SearchFilterRow } from "@/components/search-filter-row";
import { edgeAt } from "@/lib/card-edges";
import { useText } from "@/lib/i18n/use-text";

import type { ContentEntry, ContentSection, EntryContentList } from "@norish/shared-react/lists";
import { ENTRY_KINDS, useContentList } from "@norish/shared-react/lists";

import { LIST_ICONS } from "../utils/content-lists";
import { ContentSkeleton } from "./content-skeleton";

type Row =
  | { type: "heading"; key: string; section: ContentSection }
  | { type: "entry"; key: string; entry: ContentEntry; index: number; count: number };

/** The rows of a list's sections: a heading where a section has a title, then its entries. */
function rowsOf(sections: readonly ContentSection[]): Row[] {
  return sections.flatMap((section) => [
    ...(section.title
      ? [{ type: "heading" as const, key: `heading-${section.scope}`, section }]
      : []),
    ...section.entries.map((entry, index) => ({
      type: "entry" as const,
      key: entry.id,
      entry,
      index,
      count: section.entries.length,
    })),
  ]);
}

/** A list of Tags, Cuisines or Categories: search, the unused filter, the household's entries and the server's. */
export function EntryList({
  list,
  onOpen,
  onAdd,
}: {
  list: EntryContentList;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const text = useText();
  const { loaded, failed, retry, search, setSearch, unusedOnly, setUnusedOnly, view } =
    useContentList(ENTRY_KINDS[list]);
  const icon = LIST_ICONS[list];

  if (failed) {
    return (
      <EmptyCard
        action={{
          label: text("common.actions.retry"),
          icon: "refresh-outline",
          testID: "content-retry",
          onPress: retry,
        }}
        icon="alert-circle-outline"
        placement="screen"
        testID="content-failed"
        title={text("settings.content.loadFailed")}
      />
    );
  }

  if (!loaded) return <ContentSkeleton />;

  if (view.state === "empty") {
    return (
      <EmptyCard
        action={{
          label: text("common.actions.add"),
          icon: "add",
          testID: "content-add",
          onPress: onAdd,
        }}
        icon={icon}
        placement="screen"
        testID="content-empty"
        title={text(`settings.content.empty.${list}`)}
      />
    );
  }

  const header = (
    <>
      <SearchFilterRow
        filter={{
          label: text("common.filters.title"),
          active: unusedOnly,
          testID: "content-filter",
          items: [
            {
              key: "all",
              label: text("settings.content.all"),
              systemImage: unusedOnly ? undefined : "checkmark",
              onPress: () => setUnusedOnly(false),
            },
            {
              key: "unused",
              label: text("settings.content.unused"),
              systemImage: unusedOnly ? "checkmark" : undefined,
              onPress: () => setUnusedOnly(true),
            },
          ],
        }}
        label={text(`settings.content.search.${list}`)}
        testID="content-search"
        value={search}
        onChange={setSearch}
      />
      {view.state === "nothingUnused" || view.state === "noMatch" ? (
        <EmptyCard
          icon={icon}
          placement="screen"
          testID={`content-${view.state}`}
          title={text(`settings.content.${view.state}`)}
        />
      ) : null}
    </>
  );

  return (
    <FlatList
      ListHeaderComponent={header}
      contentContainerClassName="pb-16"
      contentInsetAdjustmentBehavior="never"
      data={rowsOf(view.sections)}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      keyExtractor={(row) => row.key}
      renderItem={({ item }) =>
        item.type === "heading" ? (
          <ListHeading
            help={
              item.section.help ? text(`settings.content.help.${item.section.help}`) : undefined
            }
            testID={item.key}
            title={text(`settings.content.sections.${item.section.title}`)}
          />
        ) : (
          <CardSlice edge={edgeAt(item.index, item.count)}>
            <CountRow
              count={text("settings.content.recipes", { count: item.entry.recipeCount })}
              lockLabel={item.entry.editable ? undefined : text("settings.content.readOnly")}
              name={item.entry.name}
              testID={`content-entry-${item.entry.id}`}
              onPress={() => onOpen(item.entry.id)}
            />
          </CardSlice>
        )
      }
      showsVerticalScrollIndicator={false}
      testID="content-list"
    />
  );
}
