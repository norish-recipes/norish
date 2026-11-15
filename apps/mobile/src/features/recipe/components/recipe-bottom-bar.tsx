import React from "react";
import { Pressable, Text, View } from "react-native";
import { GlassSurface } from "@/components/glass";
import { cookModeRoute } from "@/lib/tab-routes";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { FadeEdge } from "./fade-edge";

const HEIGHT = 56;

/** The page's foot: Home back to the Recipes tab and Cook, floating in glass over the page. */
export function RecipeBottomBar({ recipeId, page }: { recipeId: string; page: string }) {
  const intl = useIntl();
  const router = useRouter();
  const [foreground, accent, accentForeground] = useThemeColor([
    "foreground",
    "accent",
    "accent-foreground",
  ] as const);

  return (
    <>
      <FadeEdge color={page} edge="bottom" height={120} solidFraction={0.28} />
      <View className="absolute right-5 bottom-[26px] left-5 flex-row items-center gap-3">
        <Pressable
          accessibilityLabel={intl.formatMessage({ id: "navbar.nav.home" })}
          accessibilityRole="button"
          className="items-center justify-center rounded-full"
          style={{ width: HEIGHT, height: HEIGHT }}
          testID="recipe-home"
          onPress={() => router.navigate("/")}
        >
          <GlassSurface radius={HEIGHT / 2} />
          <Ionicons color={foreground} name="home-outline" size={22} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className="flex-1 flex-row items-center justify-center gap-2 rounded-full"
          style={{ height: HEIGHT }}
          testID="recipe-cook"
          onPress={() => router.push(cookModeRoute(recipeId))}
        >
          <GlassSurface radius={HEIGHT / 2} tint={accent} />
          <Ionicons color={accentForeground} name="flame-outline" size={20} />
          <Text className="text-accent-foreground text-[17px] font-semibold">
            {intl.formatMessage({ id: "recipes.detail.cook" })}
          </Text>
        </Pressable>
      </View>
    </>
  );
}
