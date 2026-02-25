import { useMemo, useState } from "react";
import { Image, View } from "react-native";

import { Button } from "heroui-native/button";
import { Card } from "heroui-native/card";

import { useThemeMode, type ThemeMode } from "@/components/theme-mode-context";

const DEMO_IMAGE =
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1200&auto=format&fit=crop";

const THEME_MODES: ThemeMode[] = ["system", "light", "dark"];

function themeLabel(mode: ThemeMode) {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export default function HomeScreen() {
  const { mode, resolvedMode, setMode } = useThemeMode();
  const [tapCount, setTapCount] = useState(0);
  const statusText = useMemo(
    () => (tapCount === 0 ? "Ready to build." : `Button presses: ${tapCount}`),
    [tapCount],
  );

  return (
    <View className="flex-1 bg-background px-6 pt-16">
      <Card className="bg-content1">
        <Card.Header className="gap-3">
          <Card.Title className="text-foreground">Theme Mode</Card.Title>
          <View className="flex-row gap-2">
            {THEME_MODES.map((item) => (
              <Button
                key={item}
                size="sm"
                variant={item === mode ? "primary" : "secondary"}
                onPress={() => {
                  setMode(item);
                }}
              >
                <Button.Label>{themeLabel(item)}</Button.Label>
              </Button>
            ))}
          </View>
          <Card.Description className="text-foreground/70">
            Active palette: {resolvedMode}
          </Card.Description>
        </Card.Header>
        <Card.Body className="gap-3">
          <Card.Title className="text-foreground">HeroUI Native Showcase</Card.Title>
          <Card.Description className="text-foreground/80">
            HeroUI Native components are wired with Norish semantic theme tokens.
          </Card.Description>
          <Image
            source={{ uri: DEMO_IMAGE }}
            style={{ height: 180, width: "100%", borderRadius: 14 }}
            resizeMode="cover"
          />
          <View className="rounded-md bg-primary/15 px-3 py-2">
            <Card.Description className="text-foreground">{statusText}</Card.Description>
          </View>
        </Card.Body>
        <Card.Footer>
          <Button
            className="bg-primary"
            onPress={() => {
              setTapCount((current) => current + 1);
            }}
          >
            <Button.Label className="text-primary-foreground">Test HeroUI Native</Button.Label>
          </Button>
        </Card.Footer>
      </Card>
    </View>
  );
}
