import type { ComponentProps, ComponentRef } from "react";
import React, { useState } from "react";
import { SearchField } from "heroui-native";

/** What a ref to the field holds. */
export type SheetSearchInput = ComponentRef<typeof SearchField.Input>;

/** A search field; `onChange` is absent while what it searches loads. A `ring`ed field sits on the
 * page's ground, as the Pantry's, and rings in the accent while focused. */
export function SheetSearchField({
  label,
  testID,
  value,
  fieldRef,
  maxLength,
  ring = false,
  onChange,
  onSubmit,
}: {
  label: string;
  testID: string;
  value?: string;
  fieldRef?: ComponentProps<typeof SearchField.Input>["ref"];
  maxLength?: number;
  ring?: boolean;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const look = ring
    ? `bg-surface rounded-full border-2 ${focused ? "border-accent" : "border-transparent"}`
    : "bg-default rounded-3xl";

  return (
    <SearchField isDisabled={!onChange} value={value} onChange={onChange}>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          ref={fieldRef}
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          className={`h-12 ${look}`}
          maxLength={maxLength}
          placeholder={label}
          returnKeyType="search"
          testID={testID}
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          onSubmitEditing={onSubmit}
        />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}
