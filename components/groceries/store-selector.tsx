"use client";

import type { StoreDto, StoreColor } from "@/types";

import { Fragment, useMemo } from "react";
import { Select, SelectItem } from "@heroui/react";

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

  const handleChange = (keys: "all" | Set<React.Key>) => {
    const value = Array.from(keys)[0] as string;
    onSelectionChange(value === "none" ? null : value);
  };

  return (
    <Select
      classNames={{
        trigger: size === "sm" ? "min-h-10" : "min-h-12",
      }}
      label={label}
      placeholder={placeholder}
      selectedKeys={[selectedValue]}
      size={size}
      onSelectionChange={handleChange}
    >
      <SelectItem key="none" textValue={noStoreLabel}>
        <div className="flex items-center gap-2">
          <div className="bg-default-400 shrink-0 rounded-full p-1">
            <div className="h-3 w-3" />
          </div>
          <span className={noStoreDescription ? "text-default-400" : ""}>
            {noStoreDescription ?? noStoreLabel}
          </span>
        </div>
      </SelectItem>
      <Fragment>
        {sortedStores.map((store) => {
          const colorClasses = getStoreColorClasses(store.color as StoreColor);
          return (
            <SelectItem key={store.id} textValue={store.name}>
              <div className="flex items-center gap-2">
                <div className={`shrink-0 rounded-full p-1 ${colorClasses.bg}`}>
                  <DynamicHeroIcon className="h-3 w-3 text-white" iconName={store.icon} />
                </div>
                <span>{store.name}</span>
              </div>
            </SelectItem>
          );
        })}
      </Fragment>
    </Select>
  );
}
