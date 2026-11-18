import type { Edge } from "@/lib/card-edges";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { ItemSlice } from "@/components/card-slice";
import { DragPressable } from "@/components/drag-list/drag-list";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { StoreDto } from "@norish/shared/contracts";

import { useStoreColor } from "../hooks/use-store-color";

function CircleButton({
  icon,
  label,
  testID,
  danger = false,
  onPress,
}: {
  icon: "pencil" | "trash-outline";
  label: string;
  testID: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const [foreground, dangerColor] = useThemeColor(["foreground", "danger"] as const);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="bg-fill size-9 items-center justify-center rounded-full"
      testID={testID}
      onPress={onPress}
    >
      <Ionicons color={danger ? dangerColor : foreground} name={icon} size={16} />
    </Pressable>
  );
}

/** A Store of Manage stores: its grip, its dot and name, and edit and delete. A tap opens the
 * editor and a hold lifts the row; while it is carried it is a card of its own. */
export function StoreListRow({
  store,
  edge,
  onEdit,
  onDelete,
}: {
  store: StoreDto;
  edge: Edge;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);
  const color = useStoreColor(store.color);

  return (
    <ItemSlice className="bg-fill" edge={edge} size="sheet">
      <View className="h-14 flex-row items-center gap-3 pr-2 pl-2.5">
        <DragPressable
          accessibilityLabel={intl.formatMessage({ id: "groceries.storeManager.dragAisle" })}
          className="h-full min-w-0 flex-1 flex-row items-center gap-3"
          testID={`store-row-${store.id}`}
          onPress={onEdit}
        >
          <MaterialCommunityIcons color={muted} name="drag" size={22} />
          <View className="size-3.5 rounded-full" style={{ backgroundColor: color }} />
          <Text className="text-foreground flex-1 text-base font-medium" numberOfLines={1}>
            {store.name}
          </Text>
        </DragPressable>
        <CircleButton
          icon="pencil"
          label={intl.formatMessage(
            { id: "groceries.mobile.editStoreLabel" },
            { store: store.name }
          )}
          testID={`store-edit-${store.id}`}
          onPress={onEdit}
        />
        <CircleButton
          danger
          icon="trash-outline"
          label={intl.formatMessage(
            { id: "groceries.mobile.deleteStoreLabel" },
            { store: store.name }
          )}
          testID={`store-delete-${store.id}`}
          onPress={onDelete}
        />
      </View>
    </ItemSlice>
  );
}
