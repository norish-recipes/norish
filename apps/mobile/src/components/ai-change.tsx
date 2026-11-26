import React from "react";
import { Pressable, Text, View } from "react-native";
import { useText } from "@/lib/i18n/use-text";

/** One change AI made, as a row of a card: the food it names (opening it when `onOpen` is given),
 * what changed, and Undo with Keep where the viewer may answer it. `testID` prefixes `-<id>`,
 * `-open-<id>`, `-undo-<id>` and `-keep-<id>`. */
export function AiChange({
  id,
  subject,
  note,
  onOpen,
  onUndo,
  onKeep,
  testID,
}: {
  id: string;
  subject?: string;
  note: string;
  onOpen?: () => void;
  /** Undo and Keep show only where the viewer may answer; Keep only for a change still open. */
  onUndo?: () => void;
  onKeep?: () => void;
  testID: string;
}) {
  const text = useText();

  return (
    <View className="gap-1.5 px-4 py-3" testID={`${testID}-${id}`}>
      {subject === undefined ? null : onOpen ? (
        <Pressable accessibilityRole="button" testID={`${testID}-open-${id}`} onPress={onOpen}>
          <Text className="text-accent-text text-base font-medium">{subject}</Text>
        </Pressable>
      ) : (
        <Text className="text-foreground text-base font-medium">{subject}</Text>
      )}
      <Text className="text-muted text-sm">{note}</Text>
      {onUndo ? (
        <View className="flex-row gap-4 pt-1">
          <Pressable accessibilityRole="button" testID={`${testID}-undo-${id}`} onPress={onUndo}>
            <Text className="text-danger text-[15px] font-medium">
              {text("settings.ingredients.changedByAI.undo")}
            </Text>
          </Pressable>
          {onKeep ? (
            <Pressable accessibilityRole="button" testID={`${testID}-keep-${id}`} onPress={onKeep}>
              <Text className="text-accent-text text-[15px] font-medium">
                {text("settings.ingredients.changedByAI.keep")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
