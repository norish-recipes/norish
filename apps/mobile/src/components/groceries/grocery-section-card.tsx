import type { GrocerySection } from "@/lib/groceries/grocery-utils";
import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";
import type { RecipeMap } from "@norish/shared-react/hooks";
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { splitSectionItems } from "@/lib/groceries/grocery-utils";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Card, useThemeColor } from "heroui-native";

import { SortableGroceryList } from "./sortable-grocery-list";

type GrocerySectionCardProps = {
  section: GrocerySection;
  recurringGroceries: RecurringGroceryDto[];
  recipeMap: RecipeMap;
  stores: StoreDto[];
  contextMode: "store" | "recipe";
  frozenIds?: ReadonlySet<string>;
  onToggleItem?: (id: string) => void;
  onPressItem?: (item: GroceryDto) => void;
  onDeleteItem?: (id: string) => void;
  onReorderItems?: (sectionId: string, orderedIds: string[]) => void;
};

export function GrocerySectionCard({
  section,
  recurringGroceries,
  recipeMap,
  stores,
  contextMode,
  frozenIds = new Set(),
  onToggleItem,
  onPressItem,
  onDeleteItem,
  onReorderItems,
}: GrocerySectionCardProps) {
  const [foregroundColor, mutedColor, separatorColor] = useThemeColor([
    "foreground",
    "muted",
    "separator",
  ] as const);

  const totalCount = section.items.length;
  const doneCount = section.items.filter((i) => i.isDone).length;
  const allDone = totalCount > 0 && doneCount === totalCount;

  // Sections that are fully done on first mount start collapsed; user can reopen freely.
  const [collapsed, setCollapsed] = useState(
    () => totalCount > 0 && section.items.every((i) => i.isDone)
  );

  // Split items into sortable (uncompleted) and done (completed) arrays.
  const { sortableItems, doneItems } = useMemo(
    () => splitSectionItems(section.items, frozenIds),
    [section.items, frozenIds]
  );

  const handleReorder = React.useCallback(
    (orderedIds: string[]) => {
      onReorderItems?.(section.id, orderedIds);
    },
    [section.id, onReorderItems]
  );

  return (
    <Card variant="secondary" className="overflow-hidden rounded-[28px]">
      <Card.Body className="p-0">
        <Pressable
          onPress={() => setCollapsed((c) => !c)}
          accessibilityRole="button"
          accessibilityState={{ expanded: !collapsed }}
          accessibilityLabel={`${section.title}, ${collapsed ? "expand" : "collapse"}`}
        >
          {({ pressed }) => (
            <View
              style={{
                paddingHorizontal: 18,
                paddingTop: 18,
                paddingBottom: collapsed ? 18 : 14,
                opacity: pressed ? 0.75 : 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              {/* Dot → checkmark: plain timing animations, no spring/bounce */}
              <View
                style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}
              >
                {allDone ? (
                  <Animated.View
                    key="check"
                    entering={ZoomIn.duration(200)}
                    exiting={ZoomOut.duration(140)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: section.tintColor,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="checkmark" size={13} color="#fff" />
                  </Animated.View>
                ) : (
                  <Animated.View
                    key="dot"
                    entering={FadeIn.duration(160)}
                    exiting={FadeOut.duration(120)}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: section.tintColor,
                    }}
                  />
                )}
              </View>

              {/* Title — no strikethrough */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: allDone ? mutedColor : foregroundColor,
                    fontSize: 17,
                    lineHeight: 22,
                    fontWeight: "700",
                    opacity: allDone ? 0.6 : 1,
                  }}
                >
                  {section.title}
                </Text>
              </View>

              {/* Done count pill — always uses tint color */}
              <View
                style={{
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  backgroundColor: `${section.tintColor}18`,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <Text style={{ color: section.tintColor, fontSize: 13, fontWeight: "700" }}>
                  {doneCount}/{totalCount}
                </Text>
                <Text style={{ color: `${section.tintColor}90`, fontSize: 12, fontWeight: "500" }}>
                  {" done"}
                </Text>
              </View>

              <Ionicons
                name={collapsed ? "chevron-forward" : "chevron-down"}
                size={16}
                color={mutedColor}
              />
            </View>
          )}
        </Pressable>

        {!collapsed ? (
          <Animated.View
            layout={LinearTransition.duration(300)}
            style={{ borderTopWidth: 1, borderTopColor: separatorColor }}
          >
            <SortableGroceryList
              sortableItems={sortableItems}
              doneItems={doneItems}
              recurringGroceries={recurringGroceries}
              recipeMap={recipeMap}
              stores={stores}
              contextMode={contextMode}
              tintColor={section.tintColor}
              onToggleItem={onToggleItem}
              onPressItem={onPressItem}
              onDeleteItem={onDeleteItem}
              onReorder={handleReorder}
            />
          </Animated.View>
        ) : null}
      </Card.Body>
    </Card>
  );
}
