import type { ComponentProps } from "react";
import React from "react";
import { Text } from "react-native";
import { Input, InputGroup } from "heroui-native";

/** A sheet's text field: a capsule in the muted fill, as the sheets' search fields are; a `prefix`
 * or `suffix` word sits inside the capsule. */
export function SheetInput({
  className,
  prefix,
  suffix,
  ...props
}: ComponentProps<typeof Input> & { prefix?: string; suffix?: string }) {
  const field = `h-12 rounded-full text-base ${className ?? ""}`;

  if (!prefix && !suffix) {
    return <Input {...props} className={`px-4 ${field}`} variant="secondary" />;
  }

  return (
    <InputGroup>
      {prefix ? (
        <InputGroup.Prefix isDecorative className="pr-1.5 pl-4">
          <Text className="text-muted text-base">{prefix}</Text>
        </InputGroup.Prefix>
      ) : null}
      <InputGroup.Input
        {...props}
        className={`${prefix ? "" : "pl-4"} ${suffix ? "" : "pr-4"} ${field}`}
        variant="secondary"
      />
      {suffix ? (
        <InputGroup.Suffix isDecorative className="pr-4 pl-1.5">
          <Text className="text-muted text-base">{suffix}</Text>
        </InputGroup.Suffix>
      ) : null}
    </InputGroup>
  );
}
