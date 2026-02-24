import { Button, Card } from "heroui-native";
import { Text, View } from "react-native";
import { Uniwind, useUniwind } from "uniwind";

import { nextTheme, type ThemeMode } from "../src/lib/theme-mode";

const toThemeMode = (theme: string): ThemeMode => {
  return theme === "dark" ? "dark" : "light";
};

export default function StarterPage() {
  const { theme } = useUniwind();
  const themeMode = toThemeMode(theme);

  const onToggleTheme = () => {
    Uniwind.setTheme(nextTheme(themeMode));
  };

  return (
    <View className="bg-background flex-1 items-center justify-center px-6">
      <Card className="bg-content1 w-full max-w-md">
        <Card.Header>
          <Card.Title className="text-foreground text-xl">Norish Mobile Starter</Card.Title>
          <Card.Description className="text-muted-foreground">
            Norish theme is active ({themeMode}).
          </Card.Description>
        </Card.Header>
        <Card.Body>
          <Text className="text-foreground">This starter screen uses HeroUI Native + Uniwind.</Text>
        </Card.Body>
        <Card.Footer>
          <Button variant="secondary" onPress={onToggleTheme}>
            Toggle to {nextTheme(themeMode)}
          </Button>
        </Card.Footer>
      </Card>
    </View>
  );
}
