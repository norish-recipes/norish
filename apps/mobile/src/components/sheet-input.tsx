import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { Text } from "react-native";
import { Input, InputGroup, TextArea } from "heroui-native";

/** The one field: the sand fill, a capsule 48 pt tall, no ring, shadow or focus outline. */
export const SHEET_FIELD =
  "bg-sand h-12 rounded-full text-base ios:shadow-none ios:focus:outline-transparent";

/** The same field for several lines: the sand fill and no ring, rounded to a card instead of a capsule. */
const SHEET_TEXT_AREA =
  "bg-sand rounded-3xl px-4 py-3.5 text-base leading-[23px] ios:shadow-none ios:focus:outline-transparent";

/** A sheet's multi-line field, as tall as its `style` makes it. */
export function SheetTextArea({ className, ...props }: ComponentProps<typeof TextArea>) {
  return <TextArea {...props} className={`${SHEET_TEXT_AREA} ${className ?? ""}`} />;
}

/** A sheet's text field: a capsule, as the sheets' search fields are; a `prefix` or `suffix` sits
 * inside the capsule, a word in the muted colour or a node such as an icon or a clear button. */
export function SheetInput({
  className,
  prefix,
  suffix,
  ...props
}: ComponentProps<typeof Input> & { prefix?: ReactNode; suffix?: ReactNode }) {
  const field = `${SHEET_FIELD} ${className ?? ""}`;
  const word = (node: ReactNode) =>
    typeof node === "string" ? <Text className="text-muted text-base">{node}</Text> : node;

  if (!prefix && !suffix) {
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
        className={`${prefix ? "" : "pl-4"} ${suffix ? "" : "pr-4"} ${field}`}
        variant="secondary"
      />
      {suffix ? (
        <InputGroup.Suffix isDecorative={typeof suffix === "string"} className="pr-4 pl-1.5">
          {word(suffix)}
        </InputGroup.Suffix>
      ) : null}
    </InputGroup>
  );
}
