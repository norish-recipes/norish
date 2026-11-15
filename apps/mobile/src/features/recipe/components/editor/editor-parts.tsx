import type { ComponentProps, ReactNode } from "react";
import React, { use } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { withUniwind } from "uniwind";

import { FocusedFieldContext } from "../../hooks/use-focused-field-in-view";

/** An icon coloured by a class, as `text-accent-text`, which has no theme colour hook. */
export const ClassIcon = withUniwind(Ionicons, {
  color: { fromClassName: "colorClassName", styleProperty: "color" },
});

/** The editor's text field: plain, 17 pt, growing with its text when multiline. */
export function EditorInput({ onFocus, ...props }: ComponentProps<typeof TextInput>) {
  const [muted] = useThemeColor(["muted"] as const);
  const reportFocus = use(FocusedFieldContext);

  return (
    <TextInput
      className="text-foreground py-0 text-[17px] leading-6"
      placeholderTextColor={muted}
      scrollEnabled={false}
      onFocus={(event) => {
        // The old architecture's numeric tag can't be measured; Fabric hands the element.
        if (typeof event.currentTarget !== "number") reportFocus?.(event.currentTarget);
        onFocus?.(event);
      }}
      {...props}
    />
  );
}

/** A labelled field in a card, ruled off above; `error` rings it in danger. */
export function EditorField({
  label,
  error,
  first = false,
  children,
}: {
  label: ReactNode;
  error?: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      className={
        error
          ? "border-danger -mx-2 gap-1 rounded-2xl border-2 px-2 py-3"
          : `gap-1 py-3 ${first ? "" : "border-separator border-t"}`
      }
    >
      {typeof label === "string" ? (
        <Text className="text-muted text-[13px] font-semibold">{label}</Text>
      ) : (
        label
      )}
      {children}
      {error ? <Text className="text-danger text-[13px] font-medium">{error}</Text> : null}
    </View>
  );
}

/** The small (i) beside a title: its hint opens in an alert. */
export function HintButton({ hint, title }: { hint: string; title?: string }) {
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <Pressable
      accessibilityLabel={hint}
      accessibilityRole="button"
      hitSlop={10}
      onPress={() => Alert.alert(title ?? hint, title ? hint : undefined)}
    >
      <Ionicons color={muted} name="information-circle-outline" size={18} />
    </Pressable>
  );
}

/** A card title with its hint beside it. */
export function TitleWithHint({ title, hint }: { title: string; hint: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text
        accessibilityRole="header"
        className="text-foreground text-xl font-semibold tracking-[-0.4px]"
      >
        {title}
      </Text>
      <HintButton hint={hint} title={title} />
    </View>
  );
}

/** The row under a list that adds one more: a plus and its label in the accent. */
export function AddRow({
  label,
  testID,
  onPress,
}: {
  label: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="border-separator min-h-12 flex-row items-center gap-2.5 border-t"
      testID={testID}
      onPress={onPress}
    >
      <ClassIcon colorClassName="text-accent-text" name="add" size={20} />
      <Text className="text-accent-text text-[17px] font-medium">{label}</Text>
    </Pressable>
  );
}

/** A small icon button inside a row, such as remove or add a step photo. */
export function RowIconButton({
  icon,
  label,
  testID,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  testID?: string;
  onPress: () => void;
}) {
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="size-8 items-center justify-center"
      hitSlop={6}
      testID={testID}
      onPress={onPress}
    >
      <Ionicons color={muted} name={icon} size={18} />
    </Pressable>
  );
}
