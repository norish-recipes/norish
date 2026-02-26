import { ScrollView, Text } from "react-native";

export default function DashboardHomeScreen() {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 32,
      }}
    >
      <Text className="text-3xl font-semibold text-foreground">Your recipes</Text>
    </ScrollView>
  );
}
