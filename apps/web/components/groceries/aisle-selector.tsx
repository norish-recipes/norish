"use client";

import type { Key } from "react";
import { usePanelPortalContainer } from "@/components/Panel/Panel";
import { Label, ListBox, Select } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { AisleDto } from "@norish/shared/contracts";
import { sortAisles } from "@norish/shared/lib/aisles";

const NO_AISLE = "none";

interface AisleSelectorProps {
  /** The chosen Store's aisles; the field is not rendered for a Store without any. */
  aisles: AisleDto[];
  /** The aisle the name is filed under as the panel holds it, or null for none. */
  selectedAisleId: string | null;
  onSelectionChange: (aisleId: string | null) => void;
}

/**
 * The Aisle field of the grocery panel: the chosen Store's aisles in the
 * Store's order, and "No aisle". It reads what the Store remembers for the
 * name and writes nothing itself — filing reads as correcting a fact, and the
 * panel's own Save is what files.
 */
export function AisleSelector({ aisles, selectedAisleId, onSelectionChange }: AisleSelectorProps) {
  const t = useTranslations("groceries.panel");
  const portalContainer = usePanelPortalContainer();
  const ordered = sortAisles(aisles);
  // An aisle the Store no longer has reads as none, rather than as a blank.
  const selectedKey = ordered.some((aisle) => aisle.id === selectedAisleId)
    ? (selectedAisleId as string)
    : NO_AISLE;

  const handleChange = (value: Key | null) => {
    const key = value?.toString() ?? NO_AISLE;

    onSelectionChange(key === NO_AISLE ? null : key);
  };

  return (
    <div data-testid="aisle-selector">
      <Select
        fullWidth
        selectedKey={selectedKey}
        variant="secondary"
        onSelectionChange={handleChange}
      >
        <Label>{t("aisle")}</Label>
        <Select.Trigger className="min-h-12 items-center">
          <Select.Value className="flex items-center" />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover UNSTABLE_portalContainer={portalContainer}>
          <ListBox>
            <ListBox.Item id={NO_AISLE} textValue={t("noAisle")}>
              <span className="text-muted">{t("noAisle")}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
            {ordered.map((aisle) => (
              <ListBox.Item key={aisle.id} id={aisle.id} textValue={aisle.name}>
                <span>{aisle.name}</span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
