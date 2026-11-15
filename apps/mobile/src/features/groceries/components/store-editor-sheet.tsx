import type { Drop } from "@/components/drag-list/drag-list";
import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { DragList, DragScrollView } from "@/components/drag-list/drag-list";
import { Sheet } from "@/components/sheet";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Input, TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { EditingAisle, EditingStore } from "@norish/shared-react/groceries";
import {
  addedAisle,
  AISLE_NAME_MAX,
  aisleDraftState,
  canSaveStore,
  removedAisle,
  renamedAisle,
} from "@norish/shared-react/groceries";
import { deriveSearchAddress } from "@norish/shared/lib/search-address";
import { STORE_COLOR_KEYS, storeHue } from "@norish/shared/lib/store-colors";

import { storeColorIn } from "../hooks/use-store-color";
import { FormCard } from "./form-parts";

const FIELD = "h-[52px] rounded-[18px] px-4 text-[17px]";

/** A field's label, with the explanation behind an info icon where it needs one. */
function LabelWithInfo({ id, infoId }: { id: string; infoId?: string }) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <View className="flex-row items-center gap-1.5 px-2 pb-2">
      <Text className="text-muted text-[13px] font-medium">{intl.formatMessage({ id })}</Text>
      {infoId ? (
        <Pressable
          accessibilityLabel={intl.formatMessage({ id: infoId })}
          accessibilityRole="button"
          hitSlop={8}
          testID={`${id}-info`}
          onPress={() => Alert.alert(intl.formatMessage({ id: infoId }))}
        >
          <Ionicons color={muted} name="information-circle-outline" size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

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
      <Pressable
        accessibilityLabel={intl.formatMessage({ id: "groceries.storeManager.dragAisle" })}
        hitSlop={8}
        testID="aisle-grip"
        onLongPress={onDrag}
      >
        <Ionicons color={muted} name="reorder-two-outline" size={22} />
      </Pressable>
      <Input
        accessibilityLabel={aisle.name}
        className="h-10 flex-1 border-0 bg-transparent px-1 text-base"
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
 * The Store being added or edited: its name, shop link, colour and Aisles, held by the manager
 * and written only on Save. Aisles reorder by holding a row.
 */
export function StoreEditorSheet({
  editing,
  onChange,
  onSave,
  onBack,
}: {
  editing: EditingStore;
  onChange: (store: EditingStore) => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const intl = useIntl();
  const text = (id: string) => intl.formatMessage({ id });
  const scheme = useResolvedColorScheme();
  const [accent] = useThemeColor(["accent"] as const);
  const [draft, setDraft] = useState("");
  const link = editing.link.trim();
  const derived = link ? deriveSearchAddress(link) : null;
  const { canAdd, duplicate, listDuplicate } = aisleDraftState(editing.aisles, draft);
  const aisleRows = editing.aisles.map((aisle) => ({
    kind: "item" as const,
    key: aisle.id,
    value: aisle,
  }));
  const addAisle = () => {
    if (!canAdd) return;
    onChange({ ...editing, aisles: addedAisle(editing.aisles, draft) });
    setDraft("");
  };
  const dropAisle = (drop: Drop<null, EditingAisle>) => {
    onChange({
      ...editing,
      aisles: drop.rows.flatMap((row) => (row.kind === "item" ? [row.value] : [])),
    });

    return true;
  };

  return (
    <Sheet
      actions={
        <Sheet.Actions>
          <Sheet.Action>
            <Button
              className="h-[50px]"
              testID="store-editor-cancel"
              variant="secondary"
              onPress={onBack}
            >
              <Button.Label className="font-medium">{text("common.actions.cancel")}</Button.Label>
            </Button>
          </Sheet.Action>
          <Sheet.Action>
            <Button
              className="h-[50px]"
              isDisabled={!canSaveStore(editing)}
              testID="store-editor-save"
              variant="primary"
              onPress={onSave}
            >
              <Button.Label className="font-semibold">
                {text(editing.id ? "common.actions.save" : "groceries.storeManager.create")}
              </Button.Label>
            </Button>
          </Sheet.Action>
        </Sheet.Actions>
      }
      name="store-editor"
      title={text(editing.id ? "groceries.mobile.editStore" : "groceries.mobile.addStore")}
      onClose={onBack}
    >
      <DragScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-4"
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LabelWithInfo id="groceries.storeManager.storeName" />
        <TextField>
          <Input
            accessibilityLabel={text("groceries.storeManager.storeName")}
            className={FIELD}
            placeholder={text("groceries.storeManager.storeNamePlaceholder")}
            returnKeyType="done"
            testID="store-name"
            value={editing.name}
            onChangeText={(name) => onChange({ ...editing, name })}
          />
        </TextField>

        <View className="h-4" />
        <LabelWithInfo
          id="groceries.storeManager.shopLink"
          infoId="groceries.storeManager.shopLinkHint"
        />
        <TextField>
          <Input
            accessibilityLabel={text("groceries.storeManager.shopLink")}
            autoCapitalize="none"
            autoCorrect={false}
            className={FIELD}
            keyboardType="url"
            placeholder={text("groceries.storeManager.shopLinkPlaceholder")}
            testID="store-shop-link"
            value={editing.link}
            onChangeText={(next) => onChange({ ...editing, link: next })}
          />
        </TextField>
        {link && !derived ? (
          <Text className="text-danger px-2 pt-2 text-[13px]" testID="store-link-invalid">
            {text("groceries.storeManager.linkInvalid")}
          </Text>
        ) : null}
        {derived ? (
          <View className="flex-row items-start gap-1.5 px-2 pt-2" testID="store-link-found">
            <Ionicons color={accent} name="checkmark" size={15} />
            <Text className="text-muted flex-1 text-[13px]">
              {derived.kind === "address"
                ? `${text("groceries.storeManager.searchAddressFound")} ${derived.searchAddress}`
                : text("groceries.storeManager.websiteOnly")}
            </Text>
          </View>
        ) : null}

        <View className="h-4" />
        <LabelWithInfo id="groceries.storeManager.storeColor" />
        <View
          accessibilityRole="radiogroup"
          className="flex-row flex-wrap gap-3 px-2"
          testID="store-colors"
        >
          {STORE_COLOR_KEYS.map((color) => {
            const selected = editing.color === color;

            return (
              <Pressable
                key={color}
                accessibilityLabel={text(
                  `groceries.storeManager.colorNames.${storeHue(color).name}`
                )}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                className="size-10 items-center justify-center rounded-full border-2"
                style={{ borderColor: selected ? storeColorIn(scheme, color) : "transparent" }}
                testID={`store-color-${color}`}
                onPress={() => onChange({ ...editing, color })}
              >
                <View
                  className="size-7 rounded-full"
                  style={{ backgroundColor: storeColorIn(scheme, color) }}
                />
              </Pressable>
            );
          })}
        </View>

        <View className="h-4" />
        <LabelWithInfo
          id="groceries.storeManager.aisles"
          infoId="groceries.storeManager.aislesHint"
        />
        <FormCard>
          {aisleRows.length > 0 ? (
            <DragList
              nested
              renderHeading={() => null}
              renderItem={(aisle, drag) => (
                <AisleRow
                  aisle={aisle}
                  onDrag={drag}
                  onRemove={() =>
                    onChange({ ...editing, aisles: removedAisle(editing.aisles, aisle.id) })
                  }
                  onRename={(name) =>
                    onChange({ ...editing, aisles: renamedAisle(editing.aisles, aisle.id, name) })
                  }
                />
              )}
              rows={aisleRows}
              testID="store-aisles"
              onDrop={dropAisle}
            />
          ) : null}
          <View className="h-12 flex-row items-center gap-2 pr-2 pl-4">
            <Input
              accessibilityLabel={text("groceries.storeManager.addAisle")}
              className="h-10 flex-1 border-0 bg-transparent px-0 text-base"
              maxLength={AISLE_NAME_MAX}
              placeholder={text("groceries.storeManager.aisleNamePlaceholder")}
              returnKeyType="done"
              testID="aisle-name"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={addAisle}
            />
            <Pressable
              accessibilityLabel={text("groceries.storeManager.addAisle")}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canAdd }}
              className={`bg-default size-8 items-center justify-center rounded-full ${canAdd ? "" : "opacity-40"}`}
              disabled={!canAdd}
              testID="aisle-add"
              onPress={addAisle}
            >
              <Ionicons color={accent} name="add" size={18} />
            </Pressable>
          </View>
        </FormCard>
        {duplicate || listDuplicate ? (
          <Text className="text-danger px-2 pt-2 text-[13px]" testID="aisle-duplicate">
            {text("groceries.storeManager.aisleDuplicate")}
          </Text>
        ) : null}
      </DragScrollView>
    </Sheet>
  );
}
