import { ScrollView, Text } from "react-native";

export default function SettingsScreen() {
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
      <Text className="text-2xl font-semibold text-foreground">Settings</Text>
      <Text className="text-base text-foreground/70">Additional mobile settings are coming soon.</Text>
    </ScrollView>
  );
}
