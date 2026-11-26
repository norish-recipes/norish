import React from "react";
import { View } from "react-native";
import { Segmented } from "@/components/segmented";
import { useText } from "@/lib/i18n/use-text";

import type { ContentList } from "../utils/content-lists";
import { CONTENT_LISTS } from "../utils/content-lists";

/** The Content page's four lists as segmented tabs; a screen reader hears the selected one. */
export function ContentTabs({
  value,
  onChange,
}: {
  value: ContentList;
  onChange: (list: ContentList) => void;
}) {
  const text = useText();

  return (
    <View className="px-5 pt-2">
      <Segmented
        segments={CONTENT_LISTS.map((list) => ({
          value: list,
          label: text(`settings.content.lists.${list}`),
          testID: `content-tab-${list}`,
        }))}
        testID="content-tabs"
        value={value}
        onChange={onChange}
      />
    </View>
  );
}
