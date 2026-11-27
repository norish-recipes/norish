import React from "react";
import { Text, View } from "react-native";
import { LabelWithHint } from "@/components/hint-button";
import { Ionicons } from "@/components/icon";
import { Sheet } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { useText } from "@/lib/i18n/use-text";
import { TextField, useThemeColor } from "heroui-native";

import type { EditingStore } from "@norish/shared-react/groceries";
import { canSaveStore } from "@norish/shared-react/groceries";
import { deriveSearchAddress } from "@norish/shared/lib/search-address";

import { StoreAisleList } from "./store-aisle-list";
import { StoreColorPicker } from "./store-color-picker";

/** The Store being added or edited: its name, shop link, colour and Aisles, held by the manager
 * and written only on Save. Aisles reorder by holding a row. */
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
  const text = useText();
  const [accent, muted] = useThemeColor(["accent", "muted"] as const);
  const link = editing.link.trim();
  const derived = link ? deriveSearchAddress(link) : null;
  const label = (id: string, hintId?: string) => (
    <LabelWithHint
      hint={hintId ? text(hintId) : undefined}
      label={text(id)}
      testID={`${id}-info`}
    />
  );

  return (
    <Sheet
      back
      confirm={{
        label: text(editing.id ? "common.actions.save" : "groceries.storeManager.create"),
        disabled: !canSaveStore(editing),
        onPress: onSave,
      }}
      name="store-editor"
      title={text(editing.id ? "groceries.mobile.editStore" : "groceries.mobile.addStore")}
      onClose={onBack}
    >
      <StoreAisleList
        aisles={editing.aisles}
        header={
          <View className="px-4">
            {label("groceries.storeManager.storeName")}
            <TextField>
              <SheetInput
                accessibilityLabel={text("groceries.storeManager.storeName")}
                placeholder={text("groceries.storeManager.storeNamePlaceholder")}
                returnKeyType="done"
                testID="store-name"
                value={editing.name}
                onChangeText={(name) => onChange({ ...editing, name })}
              />
            </TextField>

            <View className="h-4" />
            {label("groceries.storeManager.shopLink", "groceries.storeManager.shopLinkHint")}
            <TextField>
              <SheetInput
                accessibilityLabel={text("groceries.storeManager.shopLink")}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder={text("groceries.storeManager.shopLinkPlaceholder")}
                prefix={<Ionicons color={muted} name="link" size={18} />}
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
            {label("groceries.storeManager.storeColor")}
            <StoreColorPicker
              value={editing.color}
              onChange={(color) => onChange({ ...editing, color })}
            />

            <View className="h-4" />
            {label("groceries.storeManager.aisles", "groceries.storeManager.aislesHint")}
          </View>
        }
        onChange={(aisles) => onChange({ ...editing, aisles })}
      />
    </Sheet>
  );
}
