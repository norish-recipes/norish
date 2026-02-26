import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text } from "react-native";

export default function RecipeDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        gap: 12,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 32,
      }}
    >
      <Text className="text-2xl font-semibold text-foreground">Recipe</Text>
      <Text className="text-base text-foreground/70">Selected recipe: {id}</Text>
    </ScrollView>
  );
}
