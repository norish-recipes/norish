"use client";

import { useVersionQuery } from "@/hooks/config/use-version-query";
import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

function getMinorVersion(version: string | undefined) {
  if (!version) return null;

  const match = version.match(/^(\d+)\.(\d+)/);

  if (!match) return null;

  return `${match[1]}.${match[2]}`;
}

type NewFeatureChipProps = {
  showOnVersion: string;
};

export default function NewFeatureChip({ showOnVersion }: NewFeatureChipProps) {
  const tCommon = useTranslations("common");
  const { currentVersion } = useVersionQuery();
  const currentMinorVersion = getMinorVersion(currentVersion);
  const targetMinorVersion = getMinorVersion(showOnVersion);

  if (!currentMinorVersion || currentMinorVersion !== targetMinorVersion) {
    return null;
  }

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
