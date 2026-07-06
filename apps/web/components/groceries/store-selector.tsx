"use client";

import type { Key } from "react";
import { useMemo } from "react";
import { Label, ListBox, Select } from "@heroui/react";

import type { StoreColor, StoreDto } from "@norish/shared/contracts";

import { DynamicHeroIcon } from "./dynamic-hero-icon";
import { getStoreColorClasses } from "./store-colors";

type StoreSelectorProps = {
  stores: StoreDto[];
  selectedStoreId: string | null;
  onSelectionChange: (storeId: string | null) => void;
  /** Label shown above the select */
  label?: string;
  /** Placeholder when nothing is selected */
  placeholder?: string;
  /** Size of the select component */
  size?: "sm" | "md" | "lg";
  /** Text for the "no store" option */
  noStoreLabel?: string;
  /** Description for the "no store" option */
  noStoreDescription?: string;
  /** Whether to show the selector even when there are no stores */
  showWhenEmpty?: boolean;
};

export function StoreSelector({
  stores,
  selectedStoreId,
  onSelectionChange,
  label = "Store",
  placeholder = "Select a store",
  size = "md",
  noStoreLabel = "Auto detect from history",
  noStoreDescription,
  showWhenEmpty = false,
}: StoreSelectorProps) {
  const sortedStores = useMemo(
    () => [...stores].sort((a, b) => a.sortOrder - b.sortOrder),
    [stores]
  );

  // Don't render if no stores and showWhenEmpty is false
  if (sortedStores.length === 0 && !showWhenEmpty) {
    return null;
  }

  const selectedValue = selectedStoreId ?? "none";

  const handleChange = (value: Key | null) => {
    const storeId = value?.toString() ?? "none";

    onSelectionChange(storeId === "none" ? null : storeId);
  };

  return (
    <Select
      fullWidth
      placeholder={placeholder}
      selectedKey={selectedValue}
      variant="secondary"
      onSelectionChange={handleChange}
    >
      <Label>{label}</Label>
      <Select.Trigger className={`${size === "sm" ? "min-h-10" : "min-h-12"} items-center`}>
        <Select.Value className="flex items-center" />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="none" textValue={noStoreDescription ?? noStoreLabel}>
            <div className="flex items-center gap-2">
              <div className="bg-muted shrink-0 rounded-full p-1">
                <div className="h-3 w-3" />
              </div>
              <span className={noStoreDescription ? "text-muted" : ""}>
                {noStoreDescription ?? noStoreLabel}
              </span>
            </div>
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {sortedStores.map((store) => {
            const colorClasses = getStoreColorClasses(store.color as StoreColor);

            return (
              <ListBox.Item key={store.id} id={store.id} textValue={store.name}>
                <div className="flex items-center gap-2">
                  <div className={`shrink-0 rounded-full p-1 ${colorClasses.bg}`}>
                    <DynamicHeroIcon className="h-3 w-3 text-white" iconName={store.icon} />
                  </div>
                  <span>{store.name}</span>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            );
          })}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
