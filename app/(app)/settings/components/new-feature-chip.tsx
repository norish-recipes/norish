"use client";

import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

export default function NewFeatureChip() {
  const tCommon = useTranslations("common");

  return (
    <Chip
      classNames={{
        base: "bg-linear-to-br from-indigo-500 to-pink-500 border-small border-white/50 shadow-pink-500/30",
      }}
      size="sm"
      variant="shadow"
    >
      {tCommon("badges.new")}
    </Chip>
  );
}
