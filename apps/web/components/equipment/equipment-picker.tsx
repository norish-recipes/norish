"use client";

import { useEffect, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { PanelPortal } from "@/components/Panel/Panel";
import { ComboBox, Input, Label, ListBox } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

const SEARCH_DELAY_MS = 250;

export type EquipmentPick = { id: string; name: string };

export function EquipmentPicker({
  label,
  excludeId,
  editableOnly,
  onPick,
}: {
  label: string;
  excludeId: string;
  editableOnly: boolean;
  onPick: (pick: EquipmentPick | null) => void;
}) {
  const t = useTranslations("settings.equipment");
  const trpc = useTRPC();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(term.trim()), SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [term]);

  const { data, isFetching } = useQuery({
    ...trpc.equipment.list.queryOptions({ search }),
    enabled: search.length > 0,
  });
  const found = (data?.items ?? []).filter(
    (item) => item.id !== excludeId && (!editableOnly || item.canEdit)
  );
  const options = found.map((item) => ({ id: item.id, name: item.name }));

  return (
    <ComboBox
      allowsEmptyCollection
      className="min-w-0 flex-1"
      inputValue={term}
      items={options}
      menuTrigger="input"
      value={picked}
      variant="secondary"
      onChange={(key) => {
        const option = options.find((candidate) => candidate.id === key);

        if (!option) return;
        setPicked(option.id);
        setTerm(option.name);
        onPick(option);
      }}
      onInputChange={(value) => {
        setTerm(value);
        if (picked !== null) {
          setPicked(null);
          onPick(null);
        }
      }}
    >
      <Label className="sr-only">{label}</Label>
      <Input data-testid="equipment-picker" placeholder={t("pickEquipment")} variant="secondary" />
      <PanelPortal>
        <ComboBox.Popover>
          <ListBox
            renderEmptyState={() => (
              <p className="text-muted px-3 py-2 text-sm">
                {term.trim() === ""
                  ? t("pickerHint")
                  : isFetching || search !== term.trim()
                    ? t("pickerSearching")
                    : t("pickerEmpty")}
              </p>
            )}
          >
            {(option: { id: string; name: string }) => (
              <ListBox.Item
                data-testid="equipment-picker-option"
                id={option.id}
                textValue={option.name}
              >
                {option.name}
              </ListBox.Item>
            )}
          </ListBox>
        </ComboBox.Popover>
      </PanelPortal>
    </ComboBox>
  );
}
