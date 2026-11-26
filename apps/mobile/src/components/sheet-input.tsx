import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { Pressable, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Input, InputGroup, Skeleton, TextArea, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/** The one field: the sand fill, a capsule 48 pt tall, no ring, shadow or focus outline. No line
 * height: iOS drops a single-line field's typed text below centre when it has one. */
export const SHEET_FIELD =
  "bg-sand border-stroke h-12 rounded-full border-[0.5px] text-[16px] ios:shadow-none ios:focus:outline-transparent";

/** A field while it loads, as tall and as round as the field. */
export function SheetFieldSkeleton() {
  return <Skeleton className="h-12 rounded-full" />;
}

/** The same field for several lines: the sand fill and no ring, rounded to a card instead of a capsule. */
const SHEET_TEXT_AREA =
  "bg-sand border-stroke rounded-[22px] border-[0.5px] px-4 py-3.5 text-base leading-[23px] ios:shadow-none ios:focus:outline-transparent";

/** A sheet's multi-line field, as tall as its `style` makes it. */
export function SheetTextArea({ className, ...props }: ComponentProps<typeof TextArea>) {
  return <TextArea {...props} className={`${SHEET_TEXT_AREA} ${className ?? ""}`} />;
}

/** A sheet's text field: a capsule, as the sheets' search fields are; a `prefix` or `suffix` sits
 * inside the capsule, a word in the muted colour or a node such as an icon. An `onClear` adds the
 * board's clear circle (`<testID>-clear`) as the suffix while the field holds a value. */
export function SheetInput({
  className,
  prefix,
  suffix,
  onClear,
  ...props
}: ComponentProps<typeof Input> & {
  prefix?: ReactNode;
  suffix?: ReactNode;
  onClear?: () => void;
}) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);
  const clear =
    onClear && props.value ? (
      <Pressable
        accessibilityLabel={intl.formatMessage({ id: "common.actions.clear" })}
        accessibilityRole="button"
        hitSlop={12}
        testID={`${props.testID}-clear`}
        onPress={onClear}
      >
        <Ionicons color={muted} name="close-circle" size={20} />
      </Pressable>
    ) : null;

  const end = clear ?? suffix;
  const field = `${SHEET_FIELD} ${className ?? ""}`;
  const word = (node: ReactNode) =>
    typeof node === "string" ? <Text className="text-muted text-base">{node}</Text> : node;

  if (!prefix && !end) {
    return <Input {...props} className={`px-4 ${field}`} variant="secondary" />;
  }

  return (
    <InputGroup>
      {prefix ? (
        <InputGroup.Prefix isDecorative className="pr-1.5 pl-4">
          {word(prefix)}
        </InputGroup.Prefix>
      ) : null}
      <InputGroup.Input
        {...props}
        className={`${prefix ? "" : "pl-4"} ${end ? "" : "pr-4"} ${field}`}
        variant="secondary"
      />
      {end ? (
        <InputGroup.Suffix className="pr-4 pl-1.5" isDecorative={typeof end === "string"}>
          {word(end)}
        </InputGroup.Suffix>
      ) : null}
    </InputGroup>
  );
}
