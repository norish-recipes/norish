import type { ComponentProps, ComponentRef } from "react";
import React from "react";
import { SearchField } from "heroui-native";

/** What a ref to the field holds. */
export type SheetSearchInput = ComponentRef<typeof SearchField.Input>;

/** The search field of a sheet; `onChange` is absent while what it searches loads. */
export function SheetSearchField({
  label,
  testID,
  value,
  fieldRef,
  onChange,
  onSubmit,
}: {
  label: string;
  testID: string;
  value?: string;
  fieldRef?: ComponentProps<typeof SearchField.Input>["ref"];
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
          autoCorrect={false}
          className="bg-default h-12 rounded-3xl"
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
