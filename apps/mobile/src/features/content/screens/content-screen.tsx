import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { ModalHeader } from "@/components/modal-header";
import { useText } from "@/lib/i18n/use-text";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useIngredientFiltersStore } from "@norish/shared-react/ingredients";
import { useConnectivity } from "@norish/shared-react/offline/react";

import { ContentTabs } from "../components/content-tabs";
import { EntryList } from "../components/entry-list";
import { IngredientList } from "../components/ingredient-list";
import { OfflineCapsule } from "@/components/offline-capsule";
import { ENTRY_KINDS, isContentList, LIST_ONE } from "../utils/content-lists";

/** Content: Tags, Cuisines, Categories and Ingredients as segmented tabs on one screen; the plus adds to the one shown. */
export function ContentScreen() {
  const text = useText();
  const router = useRouter();
  const { isOffline } = useConnectivity();
  const { list: asked } = useLocalSearchParams<{ list?: string }>();
  const [list, setList] = useState(() => (isContentList(asked) ? asked : "tags"));
  const resetFilters = useIngredientFiltersStore((state) => state.reset);

  // The Ingredients filters start fresh on each visit.
  useEffect(() => resetFilters, [resetFilters]);

  const add = () =>
    list === "ingredients"
      ? router.push("/settings/ingredient-add")
      : router.push({ pathname: "/settings/content-add", params: { kind: ENTRY_KINDS[list] } });
  const openEntry = (id: string) =>
    list !== "ingredients" &&
    router.push({ pathname: "/settings/content-entry", params: { kind: ENTRY_KINDS[list], id } });

  return (
    <>
      <ModalHeader
        back
        secondary={[
          {
            label: text(`settings.content.panel.addTitle.${LIST_ONE[list]}`),
            symbol: "plus",
            disabled: isOffline,
            onPress: add,
          },
        ]}
        title={text("settings.tabs.content")}
      />
      <View className="bg-background flex-1" testID="settings-content-screen">
        <OfflineCapsule />
        <ContentTabs value={list} onChange={setList} />
        {list === "ingredients" ? (
          <IngredientList />
        ) : (
          <EntryList key={list} list={list} onAdd={add} onOpen={openEntry} />
        )}
      </View>
    </>
  );
}
