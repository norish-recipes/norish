"use client";

import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import { APP_VERSION } from "@norish/web/config/site";

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
  const currentMinorVersion = getMinorVersion(APP_VERSION);
  const targetMinorVersion = getMinorVersion(showOnVersion);

  if (!currentMinorVersion || currentMinorVersion !== targetMinorVersion) {
    return null;
  }

  return (
    <Chip
      className="border border-white/50 bg-linear-to-br from-indigo-500 to-pink-500 text-white shadow-md shadow-pink-500/30"
      size="sm"
      variant="primary"
    >
      {tCommon("badges.new")}
    </Chip>
  );
}
