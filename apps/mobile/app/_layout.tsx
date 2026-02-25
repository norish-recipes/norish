import "../global.css";

import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native/provider";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Uniwind } from "uniwind";

import { ThemeModeProvider, type ThemeMode } from "@/components/theme-mode-context";

export default function RootLayout() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const systemColorScheme = useColorScheme();
  const resolvedMode = mode === "system" ? (systemColorScheme === "dark" ? "dark" : "light") : mode;

  useEffect(() => {
    Uniwind.setTheme(mode);
  }, [mode]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeModeProvider value={{ mode, setMode, resolvedMode }}>
        <HeroUINativeProvider config={{ devInfo: { stylingPrinciples: false } }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
          </Stack>
          <StatusBar style={resolvedMode === "dark" ? "light" : "dark"} />
        </HeroUINativeProvider>
      </ThemeModeProvider>
    </GestureHandlerRootView>
  );
}
