import React from "react";
import { Text, View } from "react-native";
import { Button } from "heroui-native";

/** A title, a line and at most one action, where a form would be. */
export function AuthStatus({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="items-center gap-2">
      <Text className="text-foreground text-center text-[17px] font-semibold">{title}</Text>
      <Text className="text-muted text-center text-[15px] font-normal">{description}</Text>
      {action ? (
        <Button className="mt-4 self-stretch rounded-full" size="lg" onPress={action.onPress}>
          <Button.Label>{action.label}</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
