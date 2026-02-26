import "../global.css";

import { useEffect, useState } from "react";
import { BottomSheet, Text as SwiftText, VStack } from "@expo/ui/swift-ui";
import { Platform, Pressable, Text, useColorScheme } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native/provider";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Uniwind } from "uniwind";

import { ThemeModeProvider, type ThemeMode } from "@/components/theme-mode-context";

export default function RootLayout() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [isSettingsPresented, setIsSettingsPresented] = useState(false);
  const systemColorScheme = useColorScheme();
  const resolvedMode = mode === "system" ? (systemColorScheme === "dark" ? "dark" : "light") : mode;

  useEffect(() => {
    Uniwind.setTheme(mode);
  }, [mode]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeModeProvider value={{ mode, setMode, resolvedMode }}>
        <HeroUINativeProvider config={{ devInfo: { stylingPrinciples: false } }}>
          <Stack
            screenOptions={{
              headerRight: () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open settings"
                  className="rounded-full bg-primary/10 px-3 py-1"
                  onPress={() => {
                    if (Platform.OS === "ios") {
                      setIsSettingsPresented(true);
                      return;
                    }

                    router.push("./settings");
                  }}
                >
                  <Text className="text-sm font-medium text-foreground">Settings</Text>
                </Pressable>
              ),
            }}
          >
            <Stack.Screen name="(tabs)" options={{ title: "Recipes", headerBackVisible: false }} />
            <Stack.Screen name="recipes/[id]" options={{ title: "Recipe" }} />
            <Stack.Screen name="settings" options={{ title: "Settings" }} />
          </Stack>
          {Platform.OS === "ios" ? (
            <BottomSheet
              isPresented={isSettingsPresented}
              onIsPresentedChange={setIsSettingsPresented}
              fitToContents
            >
              <VStack>
                <SwiftText>Settings</SwiftText>
                <SwiftText>Dashboard preferences will be added in a follow-up change.</SwiftText>
              </VStack>
            </BottomSheet>
          ) : null}
          <StatusBar style={resolvedMode === "dark" ? "light" : "dark"} />
        </HeroUINativeProvider>
      </ThemeModeProvider>
    </GestureHandlerRootView>
  );
}
