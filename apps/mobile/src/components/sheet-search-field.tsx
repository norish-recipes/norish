import React from "react";
import { SearchField } from "heroui-native";

/** The search field of a sheet; `onChange` is absent while what it searches loads. */
export function SheetSearchField({
  label,
  testID,
  value,
  onChange,
}: {
  label: string;
  testID: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <SearchField isDisabled={!onChange} value={value} onChange={onChange}>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          accessibilityLabel={label}
          autoCorrect={false}
          className="bg-default h-12 rounded-3xl"
          placeholder={label}
          returnKeyType="search"
          testID={testID}
        />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}
