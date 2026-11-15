import React from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Chip } from "heroui-native";
import { useIntl } from "react-intl";

import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import { useLoadedPageRecipe, useRecipeCookbooksQuery } from "@norish/shared-react/recipes";

import { SectionCard, useTint } from "./tint";

/** The cookbooks the recipe is in, as chips that open them; Manage files it into more. */
export function CookbooksSection() {
  const intl = useIntl();
  const router = useRouter();
  const recipe = useLoadedPageRecipe();
  const { showCookbooks } = useHiddenItemVisibility();
  const { cookbooks } = useRecipeCookbooksQuery(showCookbooks ? recipe.id : null);
  const tint = useTint();

  if (!showCookbooks || cookbooks.length === 0) return null;

  return (
    <SectionCard
      right={
        <Pressable
          accessibilityRole="button"
          className="bg-default h-9 flex-row items-center gap-1.5 rounded-full px-3.5"
          style={tint ? { backgroundColor: tint.soft } : undefined}
          testID="recipe-manage-cookbooks"
          onPress={() =>
            router.push({
              pathname: "/add-to-cookbook",
              params: { recipeId: recipe.id, name: recipe.name },
            })
          }
        >
          <Ionicons color="currentColor" name="book-outline" size={16} />
          <Text className="text-foreground text-sm font-medium">
            {intl.formatMessage({ id: "recipes.cookbooks.manage" })}
          </Text>
        </Pressable>
      }
      testID="recipe-cookbooks"
      title={intl.formatMessage({ id: "recipes.cookbooks.cardTitle" })}
    >
      <View className="flex-row flex-wrap gap-2">
        {cookbooks.map((cookbook) => (
          <Pressable
            key={cookbook.id}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: "/cookbook/[id]", params: { id: cookbook.id } })}
          >
            <Chip size="lg" variant="secondary">
              <Chip.Label>{cookbook.title}</Chip.Label>
            </Chip>
          </Pressable>
        ))}
      </View>
    </SectionCard>
  );
}
