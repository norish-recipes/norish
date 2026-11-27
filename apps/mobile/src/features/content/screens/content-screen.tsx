import type { Href } from "expo-router";
import type { ReactNode } from "react";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { ModalHeader } from "@/components/modal-header";
import { OfflineCapsule } from "@/components/offline-capsule";
import { PageControls } from "@/components/page-controls";
import { Segmented } from "@/components/segmented";
import { useText } from "@/lib/i18n/use-text";
import { useLocalSearchParams, useRouter } from "expo-router";

import type { ContentList, EntryContentList, PickerKind } from "@norish/shared-react/lists";
import { useIngredientFiltersStore } from "@norish/shared-react/ingredients";
import { CONTENT_LISTS, ENTRY_KINDS, isContentList } from "@norish/shared-react/lists";
import { useConnectivity } from "@norish/shared-react/offline/react";

import { EntryList } from "../components/entry-list";
import { IngredientList } from "../components/ingredient-list";

type ListScreen = {
  /** The list's singular, as the copy under `settings.content.panel` keys it. */
  one: PickerKind | "ingredient";
  /** Where the plus goes. */
  add: Href;
  body: (go: (href: Href) => void, add: () => void) => ReactNode;
};

const entries = (list: EntryContentList): ListScreen => ({
  one: ENTRY_KINDS[list],
  add: { pathname: "/settings/content-add", params: { kind: ENTRY_KINDS[list] } },
  body: (go, add) => (
    <EntryList
      key={list}
      list={list}
      onAdd={add}
      onOpen={(id) =>
        go({ pathname: "/settings/content-entry", params: { kind: ENTRY_KINDS[list], id } })
      }
      onUses={(id) =>
        go({ pathname: "/settings/content-uses", params: { kind: ENTRY_KINDS[list], id } })
      }
    />
  ),
});

/** What each tab opens: its add sheet, and the list it shows. */
const LISTS: Record<ContentList, ListScreen> = {
  tags: entries("tags"),
  cuisines: entries("cuisines"),
  categories: entries("categories"),
  ingredients: {
    one: "ingredient",
    add: "/settings/ingredient-add",
    body: () => <IngredientList />,
  },
};

/** Content: Tags, Cuisines, Categories and Ingredients as segmented tabs on one screen; the plus adds to the one shown. */
export function ContentScreen() {
  const text = useText();
  const router = useRouter();
  const { isOffline } = useConnectivity();
  const { list: asked } = useLocalSearchParams<{ list?: string }>();
  const [list, setList] = useState(() => (isContentList(asked) ? asked : "tags"));
  const [seen, setSeen] = useState(asked);

  // A new `?list=` moves the tab; the tab the reader picks in between stays theirs.
  if (asked !== seen) {
    setSeen(asked);
    if (isContentList(asked)) setList(asked);
  }
  const resetFilters = useIngredientFiltersStore((state) => state.reset);

  // The Ingredients filters start fresh on each visit.
  useEffect(() => resetFilters, [resetFilters]);

  const shown = LISTS[list];
  const add = () => router.push(shown.add);

  return (
    <>
      <ModalHeader
        back
        secondary={[
          {
            label: text(`settings.content.panel.addTitle.${shown.one}`),
            symbol: "plus",
            disabled: isOffline,
            onPress: add,
          },
        ]}
        title={text("settings.tabs.content")}
      />
      <View className="bg-background flex-1" testID="settings-content-screen">
        <OfflineCapsule />
        <PageControls>
          <Segmented
            segments={CONTENT_LISTS.map((each) => ({
              value: each,
              label: text(`settings.content.lists.${each}`),
              testID: `content-tab-${each}`,
            }))}
            tabsLabel={text("settings.tabs.content")}
            testID="content-tabs"
            value={list}
            onChange={setList}
          />
        </PageControls>
        {shown.body((href) => router.push(href), add)}
      </View>
    </>
  );
}
