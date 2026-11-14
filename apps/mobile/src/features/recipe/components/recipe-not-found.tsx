import React from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { TRPCClientError } from "@trpc/client";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/** The server answered that the recipe is gone, or was never the reader's to open. */
export const isRecipeNotFound = (error: unknown) =>
  error instanceof TRPCClientError && error.data?.code === "NOT_FOUND";

export function RecipeNotFound() {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <View
      className="bg-background flex-1 items-center justify-center gap-2 px-10"
      testID="recipe-not-found"
    >
      <Ionicons color={muted} name="restaurant-outline" size={40} />
      <Text className="text-foreground text-xl font-semibold">
        {intl.formatMessage({ id: "recipes.detail.notFound" })}
      </Text>
      <Text className="text-muted text-center text-[15px]">
        {intl.formatMessage({ id: "recipes.detail.notFoundMessage" })}
      </Text>
    </View>
  );
}
