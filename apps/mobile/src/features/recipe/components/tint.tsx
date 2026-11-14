import type { ReactNode } from "react";
import React, { createContext, use } from "react";
import { Text, View } from "react-native";

import type { DishTint } from "../utils/dish-tint";

/** The page's Dish Colour tint, or null on the plain theme. */
export const TintContext = createContext<DishTint | null>(null);

export const useTint = () => use(TintContext);

/** One section's card: a title with room for controls beside it, then its content. */
export function SectionCard({
  title,
  right,
  children,
  testID,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  const tint = useTint();

  return (
    <View
      className="bg-surface rounded-3xl px-[18px] pt-2 pb-4"
      style={tint ? { backgroundColor: tint.card } : undefined}
      testID={testID}
    >
      {title || right ? (
        <View className="h-[52px] flex-row items-center justify-between gap-2">
          {title ? (
            <Text
              accessibilityRole="header"
              className="text-foreground text-xl font-semibold tracking-[-0.4px]"
            >
              {title}
            </Text>
          ) : null}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}
