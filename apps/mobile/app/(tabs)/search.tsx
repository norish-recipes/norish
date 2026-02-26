import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function SearchScreen() {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        gap: 16,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 32,
      }}
    >
      <Text className="text-2xl font-semibold text-foreground">Search</Text>
      <Text className="text-base text-foreground/70">Find recipes by ingredient, title, or category.</Text>

      <Link href="../recipes/featured" asChild>
        <Pressable className="rounded-xl bg-content2 px-4 py-3">
          <Text className="text-base font-medium text-foreground">Open a sample result</Text>
        </Pressable>
      </Link>

      <View style={{ height: 920 }} />
    </ScrollView>
  );
}
