import React, { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Sheet, SheetList } from "@/components/sheet";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { takeChoice } from "../components/editor/choice-request";

/** A searchable list over the editor, for its country and cuisines: what it asked for in `requestChoice`. */
export function EditorChoiceScreen() {
  const intl = useIntl();
  const router = useRouter();
  const [request] = useState(takeChoice);
  const [selected, setSelected] = useState(request?.selected ?? []);
  const [query, setQuery] = useState("");
  const [muted, accent] = useThemeColor(["muted", "accent"] as const);

  // A relaunch restores the route without the request that opened it.
  useEffect(() => {
    if (!request) router.back();
  }, [request, router]);

  if (!request) return null;

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? request.choices.filter((choice) => choice.label.toLowerCase().includes(needle))
    : request.choices;

  const pick = (key: string) => {
    const ticked = selected.includes(key);

    if (!request.multiple) {
      request.onChange(ticked ? [] : [key]);
      router.back();

      return;
    }
    const next = ticked ? selected.filter((candidate) => candidate !== key) : [...selected, key];

    setSelected(next);
    request.onChange(next);
  };

  return (
    <Sheet name={request.name} title={request.title}>
      <SheetList
        ListHeaderComponent={
          <View className="bg-default mb-2 h-10 flex-row items-center gap-2 rounded-full px-3.5">
            <Ionicons color={muted} name="search" size={16} />
            <TextInput
              accessibilityLabel={intl.formatMessage({ id: "common.actions.search" })}
              autoCorrect={false}
              className="text-foreground flex-1 py-0 text-base"
              placeholder={intl.formatMessage({ id: "common.actions.search" })}
              placeholderTextColor={muted}
              testID={`${request.name}-search`}
              value={query}
              onChangeText={setQuery}
            />
          </View>
        }
        data={shown}
        keyExtractor={(choice) => choice.key}
        renderItem={({ item, index }) => {
          const ticked = selected.includes(item.key);

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: ticked }}
              className={`min-h-12 flex-row items-center justify-between ${index === 0 ? "" : "border-separator border-t"}`}
              testID={`${request.name}-${item.key}`}
              onPress={() => pick(item.key)}
            >
              <Text className="text-foreground flex-1 text-[17px]">{item.label}</Text>
              {ticked ? <Ionicons color={accent} name="checkmark" size={20} /> : null}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}
