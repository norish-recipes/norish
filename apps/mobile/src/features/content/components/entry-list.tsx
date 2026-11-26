import React from "react";
import { CardSlice } from "@/components/card-slice";
import { CountRow } from "@/components/count-row";
import { ListFrame } from "@/components/list-frame";
import { ListHeading } from "@/components/list-heading";
import { HeadingRow, sectionRows } from "@/components/section-rows";
import { edgeAt } from "@/lib/card-edges";
import { useText } from "@/lib/i18n/use-text";

import type { EntryContentList } from "@norish/shared-react/lists";
import { ENTRY_KINDS, useContentList } from "@norish/shared-react/lists";

import { LIST_ICONS } from "../utils/content-lists";

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
  const rows = sectionRows(
    view.sections.map((section) => ({
      key: section.scope,
      section,
      heading: Boolean(section.title),
      items: section.entries,
    })),
    (entry) => entry.id
  );

  return (
    <ListFrame
      blank={
        view.state === "empty"
          ? {
              action: {
                label: text(`settings.content.panel.addTitle.${ENTRY_KINDS[list]}`),
                icon: "add",
                testID: "content-add",
                onPress: onAdd,
              },
              icon,
              testID: "content-empty",
              title: text(`settings.content.empty.${list}`),
            }
          : undefined
      }
      data={rows}
      failed={failed ? { title: text("settings.content.loadFailed"), onRetry: retry } : undefined}
      keyExtractor={(row) => row.key}
      loading={!loaded}
      nothing={
        view.state === "nothingUnused" || view.state === "noMatch"
          ? {
              icon,
              testID: `content-${view.state}`,
              title: text(`settings.content.${view.state}`),
            }
          : undefined
      }
      renderItem={({ item }) =>
        item.type === "heading" ? (
          <HeadingRow first={item.first}>
            <ListHeading
              help={
                item.section.help ? text(`settings.content.help.${item.section.help}`) : undefined
              }
              testID={item.key}
              title={text(`settings.content.sections.${item.section.title}`)}
            />
          </HeadingRow>
        ) : (
          <CardSlice edge={edgeAt(item.index, item.count)}>
            <CountRow
              count={text("settings.content.countCell", { count: item.item.recipeCount })}
              countLabel={text("settings.content.recipes", { count: item.item.recipeCount })}
              lockLabel={item.item.editable ? undefined : text("settings.content.readOnly")}
              name={item.item.name}
              testID={`content-entry-${item.item.id}`}
              onPress={() => onOpen(item.item.id)}
            />
          </CardSlice>
        )
      }
      search={{
        filter: {
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
        },
        label: text(`settings.content.search.${list}`),
        testID: "content-search",
        value: search,
        onChange: setSearch,
      }}
      testID="content"
    />
  );
}
