import type { DragListHandle, Drop } from "@/components/drag-list/drag-list";
import type { ReactElement } from "react";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ItemSlice } from "@/components/card-slice";
import { DragGrip } from "@/components/drag-list/drag-grip";
import { DragList } from "@/components/drag-list/drag-list";
import { FULL_SHEET_TOP } from "@/components/sheet";
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
/** The sheet pads for the keyboard over 250 ms, a Reanimated change that fires no layout event. */
const SHEET_SETTLE_MS = 300;

/** An Aisle's slice of the list's card; while a drag carries it, a card of its own. */
function AisleRow({
  aisle,
  first,
  onRename,
  onRemove,
}: {
  aisle: EditingAisle;
  first: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <ItemSlice edge={{ top: first, bottom: false }} size="sheet">
      <View className="h-12 flex-row items-center gap-2 pr-2 pl-2.5">
        <DragGrip
          label={intl.formatMessage({ id: "groceries.storeManager.dragAisle" })}
          testID="aisle-grip"
        />
        <Input
          accessibilityLabel={aisle.name}
          className="ios:shadow-none ios:outline-transparent ios:focus:outline-transparent h-10 flex-1 border-0 bg-transparent px-1 text-base shadow-none focus:border-0"
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
    </ItemSlice>
  );
}

/** The Store's Aisles as one drag list under `header`, with the add field as its footer, kept
 * above the keyboard and the sheet's actions while it is typed in. */
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
  const { scrollRef, onScroll, onFieldFocus, onContentSizeChange } =
    useFocusedFieldInView<DragListHandle>(
      // A field measures from the sheet's top, the keyboard from the screen's.
      FULL_SHEET_TOP + ACTIONS_HEIGHT + 8,
      SHEET_SETTLE_MS
    );
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
            className={`bg-fill overflow-hidden ${rows.length > 0 ? "border-separator rounded-b-[22px] border-t" : "rounded-[22px]"}`}
          >
            <View className="h-12 flex-row items-center gap-2 pr-2 pl-4">
              <Input
                accessibilityLabel={text("groceries.storeManager.addAisle")}
                className="ios:shadow-none ios:outline-transparent ios:focus:outline-transparent h-10 flex-1 border-0 bg-transparent px-0 text-base shadow-none focus:border-0"
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
                className={`bg-fill size-8 items-center justify-center rounded-full ${canAdd ? "" : "opacity-40"}`}
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
      renderItem={({ aisle, first }) => (
        <AisleRow
          aisle={aisle}
          first={first}
          onRemove={() => onChange(removedAisle(aisles, aisle.id))}
          onRename={(name) => onChange(renamedAisle(aisles, aisle.id, name))}
        />
      )}
      rows={rows}
      showsVerticalScrollIndicator={false}
      testID="store-aisles"
      // An aisle added from the field grows the list under it; the field follows it down.
      onContentSizeChange={onContentSizeChange}
      onDrop={drop}
      onScroll={onScroll}
    />
  );
}
