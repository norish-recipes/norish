import type { Edge } from "@/lib/card-edges";
import React from "react";
import { Text, View } from "react-native";
import { ItemSlice } from "@/components/card-slice";
import { DragPressable } from "@/components/drag-list/drag-list";
import { IconButton } from "@/components/icon-button";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { StoreDto } from "@norish/shared/contracts";

import { useStoreColor } from "../hooks/use-store-color";

/** A Store of Manage stores: its grip, dot, name, item count and chevron, and Delete. A tap opens
 * the editor and a hold lifts the row; while it is carried it is a card of its own. */
export function StoreListRow({
  store,
  count,
  edge,
  onEdit,
  onDelete,
}: {
  store: StoreDto;
  /** How many groceries are in the Store. */
  count: number;
  edge: Edge;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);
  const color = useStoreColor(store.color);

  return (
    <ItemSlice edge={edge} size="sheet">
      <View className="h-14 flex-row items-center gap-3 pr-2 pl-2.5">
        <DragPressable
          accessibilityLabel={intl.formatMessage(
            { id: "groceries.mobile.editStoreLabel" },
            { store: store.name }
          )}
          className="h-full min-w-0 flex-1 flex-row items-center gap-3"
          testID={`store-row-${store.id}`}
          onPress={onEdit}
        >
          <MaterialCommunityIcons color={muted} name="drag" size={22} />
          <View className="size-3.5 rounded-full" style={{ backgroundColor: color }} />
          <Text className="text-foreground flex-1 text-base font-medium" numberOfLines={1}>
            {store.name}
          </Text>
          <Text className="text-muted text-base">
            {intl.formatMessage({ id: "groceries.item.items" }, { count })}
          </Text>
          <Ionicons color={muted} name="chevron-forward" size={16} />
        </DragPressable>
        <IconButton
          icon="trash-outline"
          label={intl.formatMessage(
            { id: "groceries.mobile.deleteStoreLabel" },
            { store: store.name }
          )}
          testID={`store-delete-${store.id}`}
          tone="danger"
          onPress={onDelete}
        />
      </View>
    </ItemSlice>
  );
}
