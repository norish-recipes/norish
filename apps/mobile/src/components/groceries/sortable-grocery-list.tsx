import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";
import type { RecipeMap } from "@norish/shared-react/hooks";
import type { SortableRenderItemProps } from "react-native-reanimated-dnd";
import React, { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { Sortable, SortableItem } from "react-native-reanimated-dnd";
import * as Haptics from "expo-haptics";

import { GroceryRow } from "./grocery-row";
import { SwipeableGroceryRow } from "./swipeable-grocery-row";

/**
 * Estimated row height used as the initial guess before dynamic measurement.
 * Rows without tags ~48px, rows with tags ~72px. Using the taller value avoids
 * a visible jump when measurement comes in — items only shrink (less jarring).
 */
const ESTIMATED_ITEM_HEIGHT = 72;

type SortableGroceryListProps = {
  sortableItems: GroceryDto[];
  doneItems: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  recipeMap: RecipeMap;
  stores: StoreDto[];
  contextMode: "store" | "recipe";
  tintColor: string;
  onToggleItem?: (id: string) => void;
  onPressItem?: (item: GroceryDto) => void;
  onDeleteItem?: (id: string) => void;
  onReorder?: (orderedIds: string[]) => void;
};

function groceryRecipeName(item: GroceryDto, recipeMap: RecipeMap): string | null {
  if (!item.recipeIngredientId) return null;
  return recipeMap[item.recipeIngredientId]?.recipeName ?? null;
}

/**
 * Renders the sortable (uncompleted) grocery items via `react-native-reanimated-dnd`
 * and the done items as a static list below.
 *
 * Uses dynamic heights so rows with/without tags are measured individually.
 * The outer wrapper tracks the measured total height via `onHeightsMeasured`
 * to prevent nested-scroll conflicts with the parent `ScrollView`.
 */
export function SortableGroceryList({
  sortableItems,
  doneItems,
  recurringGroceries,
  recipeMap,
  stores,
  contextMode,
  tintColor,
  onToggleItem,
  onPressItem,
  onDeleteItem,
  onReorder,
}: SortableGroceryListProps) {
  // Track the measured total height so the wrapper can size itself correctly.
  const [measuredHeight, setMeasuredHeight] = useState(
    () => sortableItems.length * ESTIMATED_ITEM_HEIGHT
  );
  const recurringById = useMemo(
    () => new Map(recurringGroceries.map((recurring) => [recurring.id, recurring])),
    [recurringGroceries]
  );
  const storeNameById = useMemo(() => new Map(stores.map((store) => [store.id, store.name])), [stores]);

  const getContextLabel = useCallback(
    (item: GroceryDto) => {
      if (contextMode === "store") return groceryRecipeName(item, recipeMap);
      return item.storeId ? storeNameById.get(item.storeId) ?? null : "Unsorted";
    },
    [contextMode, recipeMap, storeNameById]
  );

  const handleHeightsMeasured = useCallback((heights: { [id: string]: number }) => {
    const total = Object.values(heights).reduce((sum, h) => sum + h, 0);
    setMeasuredHeight(total);
  }, []);

  const renderItem = useCallback(
    (props: SortableRenderItemProps<GroceryDto>) => {
      const { item, id, ...rest } = props;
      return (
        <SortableItem
          key={id}
          id={id}
          data={item}
          {...rest}
          onDragStart={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          onDrop={(_itemId, _position, allPositions) => {
            if (!allPositions || !onReorder) return;
            // Convert position map { id: positionIndex } to an ordered array of ids.
            const orderedIds = Object.entries(allPositions)
              .sort(([, posA], [, posB]) => posA - posB)
              .map(([itemId]) => itemId);
            onReorder(orderedIds);
          }}
        >
          <SwipeableGroceryRow onDelete={() => onDeleteItem?.(item.id)}>
            <GroceryRow
              item={item}
              recurringGrocery={
                item.recurringGroceryId ? recurringById.get(item.recurringGroceryId) ?? null : null
              }
              contextLabel={getContextLabel(item)}
              tintColor={tintColor}
              isLast={false}
              onToggle={onToggleItem}
              onPress={onPressItem}
            />
          </SwipeableGroceryRow>
        </SortableItem>
      );
    },
    [getContextLabel, recurringById, tintColor, onToggleItem, onPressItem, onDeleteItem, onReorder]
  );

  return (
    <View>
      {/* Sortable area — sized to measured content height, no internal scrolling */}
      {sortableItems.length > 0 ? (
        <View
          style={{
            height: measuredHeight,
            overflow: "hidden",
          }}
        >
          <Sortable
            data={sortableItems}
            renderItem={renderItem}
            enableDynamicHeights
            estimatedItemHeight={ESTIMATED_ITEM_HEIGHT}
            onHeightsMeasured={handleHeightsMeasured}
            useFlatList={false}
            style={{
              flex: 0,
              height: measuredHeight,
              backgroundColor: "transparent",
            }}
            contentContainerStyle={{ backgroundColor: "transparent" }}
          />
        </View>
      ) : null}

      {/* Done items — static, not draggable */}
      {doneItems.map((item, index) => (
        <SwipeableGroceryRow key={item.id} onDelete={() => onDeleteItem?.(item.id)}>
          <GroceryRow
            item={item}
            recurringGrocery={
              item.recurringGroceryId ? recurringById.get(item.recurringGroceryId) ?? null : null
            }
            contextLabel={getContextLabel(item)}
            tintColor={tintColor}
            isLast={index === doneItems.length - 1 && sortableItems.length === 0}
            onToggle={onToggleItem}
            onPress={onPressItem}
          />
        </SwipeableGroceryRow>
      ))}
    </View>
  );
}
