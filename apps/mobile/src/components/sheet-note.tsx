import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";

const TONES = { plain: "text-muted", accent: "text-accent-text", problem: "text-danger" } as const;

/** A sheet's plain note text under a field or above a card; `locked` puts the lock mark before it. */
export function SheetNote({
  children,
  tone = "plain",
  locked = false,
  testID,
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  locked?: boolean;
  testID?: string;
}) {
  const muted = useTokenColor("muted");

  return (
    <View className="flex-row items-start gap-2 px-2" testID={testID}>
      {locked ? <Ionicons color={muted} name="lock-closed-outline" size={15} /> : null}
      <Text className={`${TONES[tone]} min-w-0 flex-1 text-sm`}>{children}</Text>
    </View>
  );
}
