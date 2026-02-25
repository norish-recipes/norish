import { useMemo, useState } from "react";
import { View } from "react-native";

import { Button } from "heroui-native/button";
import { Card } from "heroui-native/card";

export default function HomeScreen() {
  const [tapCount, setTapCount] = useState(0);
  const statusText = useMemo(
    () => (tapCount === 0 ? "Ready to build." : `Button presses: ${tapCount}`),
    [tapCount],
  );

  return (
    <View className="flex-1 bg-background px-6 pt-16">
      <Card className="bg-content1">
        <Card.Body className="gap-3">
          <Card.Title className="text-foreground">Norish Mobile Starter</Card.Title>
          <Card.Description className="text-foreground/80">
            HeroUI Native is wired with shared Norish tokens.
          </Card.Description>
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
