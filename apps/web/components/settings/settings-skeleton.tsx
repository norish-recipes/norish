"use client";

import type { ComponentType, SVGProps } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

type CardPlaceholder = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** The card's messages under `settings`; absent where its title depends on the reader's data. */
  section?: string;
  description?: boolean;
  danger?: boolean;
  rows: number;
};

/**
 * A settings tab while it loads: its cards' real headers over grey rows. The tab's route and its
 * data wait both draw it.
 */
export function SettingsCardsSkeleton({
  cards,
  sideBySide = false,
}: {
  cards: CardPlaceholder[];
  sideBySide?: boolean;
}) {
  const t = useTranslations("settings");

  return (
    <div
      className={
        sideBySide ? "grid w-full grid-cols-1 gap-6 md:grid-cols-2" : "flex w-full flex-col gap-6"
      }
    >
      {cards.map(({ icon, section, description, danger, rows }, index) => (
        <SettingsCard
          key={section ?? index}
          danger={danger}
          description={section && description ? t(`${section}.description`) : undefined}
          icon={icon}
          title={section ? t(`${section}.title`) : <Skeleton className="h-6 w-48 rounded-lg" />}
        >
          {Array.from({ length: rows }, (_, row) => (
            <Skeleton key={row} className="h-12 w-full rounded-lg" />
          ))}
        </SettingsCard>
      ))}
    </div>
  );
}
