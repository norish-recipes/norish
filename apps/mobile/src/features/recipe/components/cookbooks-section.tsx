import React from "react";
import { Pressable, Text, View } from "react-native";
import { GlassIconButton } from "@/components/glass";
import { cookbookRoute } from "@/lib/tab-routes";
import { useRouter } from "expo-router";
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
        <GlassIconButton
          label={intl.formatMessage({ id: "recipes.cookbooks.manage" })}
          symbol="book"
          testID="recipe-manage-cookbooks"
          onPress={() =>
            router.push({
              pathname: "/add-to-cookbook",
              params: { recipeId: recipe.id },
            })
          }
        />
      }
      testID="recipe-cookbooks"
      title={intl.formatMessage({ id: "recipes.cookbooks.cardTitle" })}
    >
      <View className="flex-row flex-wrap gap-2">
        {cookbooks.map((cookbook) => (
          <Pressable
            key={cookbook.id}
            accessibilityRole="link"
            onPress={() => router.push(cookbookRoute(cookbook.id))}
          >
            <View
              className="bg-default h-9 justify-center rounded-full px-3.5"
              style={tint ? { backgroundColor: tint.soft } : undefined}
            >
              <Text className="text-foreground text-sm font-medium">{cookbook.title}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </SectionCard>
  );
}
