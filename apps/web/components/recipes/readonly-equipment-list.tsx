"use client";

import { useMemo } from "react";
import { EquipmentIcon, EquipmentIconsProvider } from "@/components/equipment/equipment-icon";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";

import { namesNoFood } from "@norish/shared/lib/ingredient-text";

type EquipmentLike = {
  id?: string;
  equipmentId?: string | null;
  name: string;
  order: number;
  icon?: string | null;
};

export type ReadonlyEquipmentListProps = {
  equipment: EquipmentLike[];
};

export function ReadonlyEquipmentList({ equipment }: ReadonlyEquipmentListProps) {
  const ids = useMemo(() => equipment.map((item) => item.equipmentId).filter(Boolean), [equipment]);

  if (!equipment || equipment.length === 0) {
    return null;
  }

  return (
    <EquipmentIconsProvider ids={ids}>
      <ul className="space-y-2">
        {[...equipment]
          .sort((a, b) => a.order - b.order)
          .map((item) => {
            const isHeading = item.name.trim().startsWith("#");
            const itemKey = item.id ?? `${item.order}-${item.name}`;

            if (isHeading) {
              const headingText = item.name.trim().replace(/^#+\s*/, "");

              return (
                <li key={itemKey} className="list-none">
                  <div className="px-3 py-2">
                    <h3 className="text-foreground text-base font-semibold">{headingText}</h3>
                  </div>
                </li>
              );
            }

            return (
              <EquipmentLine
                key={itemKey}
                equipmentId={item.equipmentId}
                icon={item.icon}
                name={item.name}
              />
            );
          })}
      </ul>
    </EquipmentIconsProvider>
  );
}

function EquipmentLine({
  name,
  equipmentId,
  icon,
}: {
  name: string;
  equipmentId?: string | null;
  icon?: string | null;
}) {
  return (
    <li>
      <div className="flex items-center gap-2 rounded-xl px-3 py-2 md:gap-3">
        {namesNoFood(name) ? null : <EquipmentIcon equipmentId={equipmentId} src={icon} />}

        <div className="flex flex-1 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-base">
            <SmartMarkdownRenderer text={name} />
          </span>
        </div>
      </div>
    </li>
  );
}
