import React, { useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { GlassCloseButton } from "@/components/glass";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

export type Choice = { key: string; label: string };

/**
 * A searchable list in a page sheet. With `multiple` each tap ticks a choice and the sheet stays;
 * without it a tap picks one and closes.
 */
export function ChoiceSheet({
  title,
  choices,
  selected,
  multiple = false,
  testID,
  onChange,
  onClose,
}: {
  title: string;
  choices: Choice[];
  selected: string[];
  multiple?: boolean;
  testID: string;
  onChange: (selected: string[]) => void;
  onClose: () => void;
}) {
  const intl = useIntl();
  const [query, setQuery] = useState("");
  const [muted, accent] = useThemeColor(["muted", "accent"] as const);
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? choices.filter((choice) => choice.label.toLowerCase().includes(needle))
    : choices;

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="bg-background flex-1" testID={testID}>
        <View className="flex-row items-center gap-3 px-4 pt-4 pb-3">
          <GlassCloseButton testID={`${testID}-close`} onPress={onClose} />
          <Text className="text-foreground flex-1 text-center text-[17px] font-semibold">
            {title}
          </Text>
          <View className="w-10" />
        </View>
        <View className="bg-default mx-4 mb-2 h-10 flex-row items-center gap-2 rounded-full px-3.5">
          <Ionicons color={muted} name="search" size={16} />
          <TextInput
            accessibilityLabel={intl.formatMessage({ id: "common.actions.search" })}
            autoCorrect={false}
            className="text-foreground flex-1 py-0 text-base"
            placeholder={intl.formatMessage({ id: "common.actions.search" })}
            placeholderTextColor={muted}
            testID={`${testID}-search`}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <FlatList
          contentContainerClassName="px-4 pb-10"
          data={shown}
          keyExtractor={(choice) => choice.key}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            const ticked = selected.includes(item.key);

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: ticked }}
                className={`min-h-12 flex-row items-center justify-between ${index === 0 ? "" : "border-separator border-t"}`}
                testID={`${testID}-${item.key}`}
                onPress={() => {
                  if (!multiple) {
                    onChange(ticked ? [] : [item.key]);
                    onClose();

                    return;
                  }
                  onChange(
                    ticked ? selected.filter((key) => key !== item.key) : [...selected, item.key]
                  );
                }}
              >
                <Text className="text-foreground flex-1 text-[17px]">{item.label}</Text>
                {ticked ? <Ionicons color={accent} name="checkmark" size={20} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}
