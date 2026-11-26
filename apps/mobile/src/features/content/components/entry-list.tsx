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

/** A list of Tags, Cuisines or Categories: search, the unused filter, the household's entries and the server's.
 * A section without a title (Tags) is headed by how many it lists. */
export function EntryList({
  list,
  onOpen,
  onUses,
  onAdd,
}: {
  list: EntryContentList;
  /** Opens the entry; `delete` has its sheet ask to delete it at once. */
  onOpen: (id: string, intent?: "delete") => void;
  onUses: (id: string) => void;
  onAdd: () => void;
}) {
  const text = useText();
  const kind = ENTRY_KINDS[list];
  const { loaded, failed, retry, offline, search, setSearch, unusedOnly, setUnusedOnly, view } =
    useContentList(kind);
  const icon = LIST_ICONS[list];
  const rows = sectionRows(
    view.sections.map((section) => ({
      key: section.scope,
      section,
      heading: true,
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
                label: text(`settings.content.panel.addTitle.${kind}`),
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
              title={
                item.section.title
                  ? text(`settings.content.sections.${item.section.title}`)
                  : text(`settings.content.${unusedOnly ? "countUnused" : "count"}.${kind}`, {
                      count: item.section.entries.length,
                    })
              }
            />
          </HeadingRow>
        ) : (
          <CardSlice edge={edgeAt(item.index, item.count)}>
            <CountRow
              count={text("settings.content.countCell", { count: item.item.recipeCount })}
              countLabel={text("settings.content.recipes", { count: item.item.recipeCount })}
              lockLabel={item.item.editable ? undefined : text("settings.content.readOnly")}
              menu={
                item.item.editable
                  ? [
                      {
                        key: "uses",
                        label: text("settings.content.menu.showRecipes"),
                        systemImage: "book",
                        onPress: () => onUses(item.item.id),
                      },
                      ...(offline
                        ? []
                        : [
                            {
                              key: "rename",
                              label: text("settings.content.menu.rename"),
                              systemImage: "pencil",
                              onPress: () => onOpen(item.item.id),
                            },
                            {
                              key: "delete",
                              label: text("common.actions.delete"),
                              systemImage: "trash",
                              destructive: true,
                              onPress: () => onOpen(item.item.id, "delete"),
                            },
                          ]),
                    ]
                  : undefined
              }
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
