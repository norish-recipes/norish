import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useLoadedPageRecipe } from "@norish/shared-react/recipes";

import { useTokenColor } from "../hooks/use-token-color";
import { SectionCard } from "./tint";

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** The page the recipe came from, and who added it. */
export function SourceSection() {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const [muted] = useThemeColor(["muted"] as const);
  const accent = useTokenColor("accent-text");
  const author = recipe.author?.name ?? null;

  if (!recipe.url && !author) return null;

  return (
    <SectionCard testID="recipe-source" title={intl.formatMessage({ id: "recipes.detail.source" })}>
      {recipe.url ? (
        <Pressable
          accessibilityHint={intl.formatMessage({ id: "recipes.detail.viewOriginal" })}
          accessibilityRole="link"
          className="flex-row items-center gap-3 py-2.5"
          onPress={() => void Linking.openURL(recipe.url!)}
        >
          <View className="bg-accent/10 size-8 items-center justify-center rounded-xl">
            <Ionicons color={accent} name="globe-outline" size={16} />
          </View>
          <Text className="text-foreground min-w-0 flex-1 text-base" numberOfLines={1}>
            {hostOf(recipe.url)}
          </Text>
          <Ionicons color={muted} name="open-outline" size={16} />
        </Pressable>
      ) : null}
      {author ? (
        <View className="border-separator flex-row items-center gap-3 border-t py-2.5">
          <View className="bg-avatar size-8 items-center justify-center rounded-full">
            <Text className="text-foreground text-sm font-semibold">
              {author.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text className="text-muted min-w-0 flex-1 text-base" numberOfLines={1}>
            {intl.formatMessage({ id: "recipes.detail.addedBy" }, { name: author })}
          </Text>
        </View>
      ) : null}
    </SectionCard>
  );
}
