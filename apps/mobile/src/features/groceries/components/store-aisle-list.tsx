import type { DragRow, Drop } from "@/components/drag-list/drag-list";
import type { ReactElement } from "react";
import type { FlatList } from "react-native";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { DragGrip } from "@/components/drag-list/drag-grip";
import { DragList } from "@/components/drag-list/drag-list";
import { useFocusedFieldInView } from "@/hooks/use-focused-field-in-view";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Input, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { EditingAisle } from "@norish/shared-react/groceries";
import {
  addedAisle,
  AISLE_NAME_MAX,
  aisleDraftState,
  removedAisle,
  renamedAisle,
} from "@norish/shared-react/groceries";

type AisleItem = { aisle: EditingAisle; first: boolean };

/** The sheet's actions under the list, pt-3 + 50 + pb-5, which the keyboard pushes up with it. */
const ACTIONS_HEIGHT = 82;

function AisleRow({
  aisle,
  onDrag,
  onRename,
  onRemove,
}: {
  aisle: EditingAisle;
  onDrag: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <View className="bg-surface border-separator h-12 flex-row items-center gap-2 border-b pr-2 pl-2.5">
      <DragGrip
        label={intl.formatMessage({ id: "groceries.storeManager.dragAisle" })}
        testID="aisle-grip"
        onDrag={onDrag}
      />
      <Input
        accessibilityLabel={aisle.name}
        className="h-10 flex-1 border-0 bg-transparent px-1 text-base shadow-none"
        maxLength={AISLE_NAME_MAX}
        testID="aisle-row-name"
        value={aisle.name}
        onChangeText={onRename}
      />
      <Pressable
        accessibilityLabel={intl.formatMessage({ id: "groceries.storeManager.removeAisle" })}
        accessibilityRole="button"
        className="size-8 items-center justify-center"
        testID="aisle-remove"
        onPress={onRemove}
      >
        <Ionicons color={muted} name="close" size={18} />
      </Pressable>
    </View>
  );
}

/**
 * The Store's Aisles as one drag list under `header`, with the add field as its footer, kept above
 * the keyboard and the sheet's actions while it is typed in.
 */
export function StoreAisleList({
  aisles,
  onChange,
  header,
}: {
  aisles: EditingAisle[];
  onChange: (aisles: EditingAisle[]) => void;
  header: ReactElement;
}) {
  const intl = useIntl();
  const text = (id: string) => intl.formatMessage({ id });
  const [accent] = useThemeColor(["accent"] as const);
  const [draft, setDraft] = useState("");
  const { scrollRef, onScroll, onFieldFocus, onContentSizeChange } = useFocusedFieldInView<
    FlatList<DragRow<null, AisleItem>>
  >(ACTIONS_HEIGHT + 8);
  const { canAdd, duplicate, listDuplicate } = aisleDraftState(aisles, draft);
  const rows = aisles.map((aisle, index) => ({
    kind: "item" as const,
    key: aisle.id,
    value: { aisle, first: index === 0 },
  }));
  const add = () => {
    if (!canAdd) return;
    onChange(addedAisle(aisles, draft));
    setDraft("");
  };
  const drop = (landed: Drop<null, AisleItem>) => {
    onChange(landed.rows.flatMap((row) => (row.kind === "item" ? [row.value.aisle] : [])));

    return true;
  };

  return (
    <DragList
      ref={scrollRef}
      ListFooterComponent={
        <View className="px-4">
          <View
            className={`bg-surface overflow-hidden ${rows.length > 0 ? "rounded-b-[22px]" : "rounded-[22px]"}`}
          >
            <View className="h-12 flex-row items-center gap-2 pr-2 pl-4">
              <Input
                accessibilityLabel={text("groceries.storeManager.addAisle")}
                className="h-10 flex-1 border-0 bg-transparent px-0 text-base shadow-none"
                maxLength={AISLE_NAME_MAX}
                placeholder={text("groceries.storeManager.aisleNamePlaceholder")}
                returnKeyType="done"
                testID="aisle-name"
                value={draft}
                onChangeText={setDraft}
                onFocus={(event) => {
                  // The old architecture's numeric tag can't be measured; Fabric hands the element.
                  if (typeof event.currentTarget !== "number") onFieldFocus(event.currentTarget);
                }}
                onSubmitEditing={add}
              />
              <Pressable
                accessibilityLabel={text("groceries.storeManager.addAisle")}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canAdd }}
                className={`bg-default size-8 items-center justify-center rounded-full ${canAdd ? "" : "opacity-40"}`}
                disabled={!canAdd}
                testID="aisle-add"
                onPress={add}
              >
                <Ionicons color={accent} name="add" size={18} />
              </Pressable>
            </View>
          </View>
          {duplicate || listDuplicate ? (
            <Text className="text-danger px-2 pt-2 text-[13px]" testID="aisle-duplicate">
              {text("groceries.storeManager.aisleDuplicate")}
            </Text>
          ) : null}
        </View>
      }
      ListHeaderComponent={header}
      className="flex-1"
      contentContainerClassName="pb-4"
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      renderHeading={() => null}
      renderItem={({ aisle, first }, drag) => (
        <View className="px-4">
          <View className={`bg-surface overflow-hidden ${first ? "rounded-t-[22px]" : ""}`}>
            <AisleRow
              aisle={aisle}
              onDrag={drag}
              onRemove={() => onChange(removedAisle(aisles, aisle.id))}
              onRename={(name) => onChange(renamedAisle(aisles, aisle.id, name))}
            />
          </View>
        </View>
      )}
      rows={rows}
      showsVerticalScrollIndicator={false}
      testID="store-aisles"
      // The list shrinks as the sheet makes room for the keyboard; the field follows it up.
      onContentSizeChange={onContentSizeChange}
      onDrop={drop}
      onLayout={onContentSizeChange}
      onScroll={onScroll}
    />
  );
}
