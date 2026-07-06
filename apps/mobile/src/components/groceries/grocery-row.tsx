import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { formatAmountUnit } from "@/lib/groceries/grocery-utils";
import Animated, { LinearTransition } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

type GroceryRowProps = {
  item: GroceryDto;
  recurringGrocery: RecurringGroceryDto | null;
  contextLabel: string | null;
  tintColor: string;
  isLast: boolean;
  onToggle?: (id: string) => void;
  onPress?: (item: GroceryDto) => void;
};

export const GroceryRow = React.memo(function GroceryRow({
  item,
  recurringGrocery,
  contextLabel,
  tintColor,
  isLast,
  onToggle,
  onPress,
}: GroceryRowProps) {
  const [foregroundColor, mutedColor, separatorColor, backgroundColor] = useThemeColor([
    "foreground",
    "muted",
    "separator",
    "background",
  ] as const);

  return (
    <Animated.View layout={LinearTransition.duration(300)}>
      <Pressable
        onPress={() => onPress?.(item)}
        accessibilityRole="button"
        style={{
          paddingHorizontal: 16,
          paddingVertical: 13,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: separatorColor,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Checkmark circle — uses section tint color */}
        <Pressable
          onPress={() => onToggle?.(item.id)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.isDone }}
          hitSlop={8}
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: item.isDone ? 0 : 2,
            borderColor: `${tintColor}70`,
            backgroundColor: item.isDone ? tintColor : "transparent",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {item.isDone ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </Pressable>

        {/* Content */}
        <View style={{ flex: 1, gap: 4 }}>
          {/* Name + amount */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                flex: 1,
                color: foregroundColor,
                fontSize: 16,
                lineHeight: 21,
                fontWeight: "600",
                textDecorationLine: item.isDone ? "line-through" : "none",
                opacity: item.isDone ? 0.45 : 1,
              }}
            >
              {item.name}
            </Text>

            <View
              style={{
                borderRadius: 9,
                paddingHorizontal: 9,
                paddingVertical: 4,
                backgroundColor,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: item.isDone ? mutedColor : foregroundColor,
                  fontSize: 12,
                  fontWeight: "700",
                  opacity: item.isDone ? 0.5 : 1,
                }}
              >
                {formatAmountUnit(item.amount, item.unit)}
              </Text>
            </View>
          </View>

          {/* Tags — recurring + context on same line */}
          {recurringGrocery || contextLabel ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {recurringGrocery ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 7,
                    paddingHorizontal: 7,
                    paddingVertical: 3,
                    backgroundColor: `${tintColor}18`,
                  }}
                >
                  <Ionicons name="repeat-outline" size={11} color={tintColor} />
                  <Text style={{ color: tintColor, fontSize: 11, fontWeight: "700" }}>
                    Recurring
                  </Text>
                </View>
              ) : null}

              {contextLabel ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 7,
                    paddingHorizontal: 7,
                    paddingVertical: 3,
                    backgroundColor,
                  }}
                >
                  <Ionicons name="sparkles-outline" size={11} color={mutedColor} />
                  <Text style={{ color: mutedColor, fontSize: 11, fontWeight: "600" }}>
                    {contextLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
});
