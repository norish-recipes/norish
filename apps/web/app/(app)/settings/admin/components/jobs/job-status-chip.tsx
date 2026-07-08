"use client";

import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { AdminJobRowDTO } from "@norish/shared/contracts";

type Props = {
  state: AdminJobRowDTO["state"];
  isHanging: boolean;
};

// completed uses the app's primary (accent) color; active is blue via
// the .chip--info override in globals.css (HeroUI has no blue variant)
const stateColors: Record<
  AdminJobRowDTO["state"],
  "success" | "warning" | "default" | "danger" | "accent"
> = {
  waiting: "warning",
  active: "default",
  delayed: "warning",
  completed: "accent",
  failed: "danger",
  paused: "default",
  prioritized: "default",
  unknown: "default",
};

export default function JobStatusChip({ state, isHanging }: Props) {
  const t = useTranslations("settings.admin.jobQueue.status");

  if (isHanging) {
    return (
      <Chip color="danger" size="sm" variant="soft">
        {t("hanging")}
      </Chip>
    );
  }

  return (
    <Chip
      className={state === "active" ? "chip--info" : undefined}
      color={stateColors[state]}
      size="sm"
      variant="soft"
    >
      {t(state)}
    </Chip>
  );
}
