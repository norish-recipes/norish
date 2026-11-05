import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useGroceriesMutations,
  useGroceriesQuery,
  useGroceriesSubscription,
} from "@/hooks/groceries";
import { useRecipesQuery } from "@/hooks/recipes";
import { useUserContext } from "@/lib/auth/user-context";
import { Button, Checkbox } from "heroui-native";

// Throwaway screen that proves sign-in, tRPC, realtime and offline end to end
// until the redesigned screens replace it.
export function SmokeScreen() {
  const { user, signOut } = useUserContext();
  const { total, isLoading: recipesLoading } = useRecipesQuery({ limit: 1 });
  const { groceries } = useGroceriesQuery();
  const { toggleGroceries, toggleRecurringGrocery } = useGroceriesMutations();

  useGroceriesSubscription();

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Text testID="smoke-user">{user ? `${user.name} <${user.email}>` : "No user"}</Text>
        <Text testID="smoke-recipe-count">
          {recipesLoading ? "Recipes: …" : `Recipes: ${total}`}
        </Text>
        <Text>Groceries</Text>
        {groceries.map((grocery) => (
          <View key={grocery.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Checkbox
              testID={`smoke-grocery-${grocery.id}`}
              isSelected={grocery.isDone}
              onSelectedChange={(isDone) =>
                grocery.recurringGroceryId
                  ? toggleRecurringGrocery(grocery.recurringGroceryId, grocery.id, isDone)
                  : toggleGroceries([grocery.id], isDone)
              }
            />
            <Text>{grocery.name}</Text>
          </View>
        ))}
        <Button variant="secondary" onPress={() => void signOut()}>
          <Button.Label>Sign out</Button.Label>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
