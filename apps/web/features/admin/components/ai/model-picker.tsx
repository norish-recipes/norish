"use client";

import { ComboBox, Description, Input, Label, ListBox } from "@heroui/react";

import type { ListingRefusal } from "./model-listing-empty-state";
import ModelListingEmptyState from "./model-listing-empty-state";

export type ModelOption = { id: string; label: string; tag?: string };

/** A model field: pick one the provider lists, or type any name; a typed name is kept as an option. */
export function ModelPicker({
  label,
  placeholder,
  description,
  value,
  options,
  isDisabled,
  isLoading,
  refusal,
  onChange,
}: {
  label: string;
  placeholder: string;
  description?: string;
  value: string;
  options: ModelOption[];
  isDisabled: boolean;
  isLoading: boolean;
  refusal?: ListingRefusal;
  onChange: (value: string) => void;
}) {
  const shown =
    value && !options.some((option) => option.id === value)
      ? [{ id: value, label: value }, ...options]
      : options;

  return (
    <ComboBox
      allowsCustomValue
      inputValue={value}
      isDisabled={isDisabled}
      onChange={(key) => key && onChange(String(key))}
      onInputChange={onChange}
    >
      <Label>{label}</Label>
      <ComboBox.InputGroup>
        <Input placeholder={placeholder} variant="secondary" />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      {description && <Description>{description}</Description>}
      <ComboBox.Popover>
        <ListBox
          renderEmptyState={() => (
            <ModelListingEmptyState isLoading={isLoading} refusal={refusal} />
          )}
        >
          {shown.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
              {option.tag ? (
                <div className="flex items-center justify-between gap-2">
                  <span>{option.label}</span>
                  <span className="text-success text-xs">{option.tag}</span>
                </div>
              ) : (
                option.label
              )}
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
