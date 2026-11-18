import type { ComponentProps, ComponentRef } from "react";
import React from "react";
import { SearchField } from "heroui-native";

import { SHEET_FIELD } from "./sheet-input";

/** What a ref to the field holds. */
export type SheetSearchInput = ComponentRef<typeof SearchField.Input>;

/** A search field in the sheet field's look; `onChange` is absent while what it searches loads.
 * A page on an opaque ground passes its own `className`. */
export function SheetSearchField({
  label,
  testID,
  value,
  fieldRef,
  maxLength,
  className = SHEET_FIELD,
  onChange,
  onSubmit,
}: {
  label: string;
  testID: string;
  value?: string;
  fieldRef?: ComponentProps<typeof SearchField.Input>["ref"];
  maxLength?: number;
  className?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <SearchField isDisabled={!onChange} value={value} onChange={onChange}>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          ref={fieldRef}
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          className={className}
          maxLength={maxLength}
          placeholder={label}
          returnKeyType="search"
          testID={testID}
          onSubmitEditing={onSubmit}
        />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}
