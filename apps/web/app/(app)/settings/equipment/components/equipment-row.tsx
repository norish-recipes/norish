"use client";

import type { EquipmentItem } from "@/components/equipment/types";
import { memo } from "react";
import { EquipmentIcon } from "@/components/equipment/equipment-icon";
import { useTranslations } from "next-intl";

export const EquipmentRow = memo(function EquipmentRow({
  item,
  onOpen,
}: {
  item: EquipmentItem;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("settings.equipment");

  return (
    <div
      className="hover:bg-default/40 flex items-stretch rounded-lg transition-colors"
      data-equipment={item.name}
      data-testid="equipment-row"
      id={item.id}
      role="listitem"
    >
      <button
        className="focus-visible:ring-focus flex min-w-0 flex-1 cursor-[var(--cursor-interactive)] items-center gap-3 rounded-lg px-3 py-3 text-left focus-visible:ring-2 focus-visible:outline-none"
        data-testid="equipment-toggle"
        type="button"
        onClick={() => onOpen(item.id)}
      >
        <EquipmentIcon src={item.icon ?? null} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 truncate font-medium">{item.name}</span>
          </div>
          <span className="text-muted text-sm">
            {t("summary", {
              spellings: item.aliases.length,
            })}
          </span>
        </div>
      </button>
    </div>
  );
});
