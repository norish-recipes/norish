"use client";

import { useSyncExternalStore } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import {
  ArrowPathIcon,
  ClipboardDocumentIcon as ClipboardDocumentIconSolid,
} from "@heroicons/react/16/solid";
import { ClipboardDocumentIcon as ClipboardDocumentIconOutline } from "@heroicons/react/24/outline";
import { Button, Input, toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { HouseholdAdminSettingsDto } from "@norish/shared/contracts/dto/household";
import { useHousehold, useHouseholdMutations } from "@norish/shared-react/reader";

const noSubscription = () => () => {};
const nowToTheSecond = () => Math.floor(Date.now() / 1000) * 1000;

function subscribeToSeconds(onTick: () => void) {
  const interval = setInterval(onTick, 1000);

  return () => clearInterval(interval);
}

export default function JoinCodeCard() {
  const t = useTranslations("settings.household.joinCode");
  const tErrors = useTranslations("common.errors");
  const { household, isAdmin } = useHousehold();
  const { regenerateJoinCode } = useHouseholdMutations();
  const joinCodeExpiresAt =
    household && "joinCode" in household && household.joinCode ? household.joinCodeExpiresAt : null;
  // The clock the countdown reads, to the second, ticking while a code counts down.
  const now = useSyncExternalStore(
    joinCodeExpiresAt ? subscribeToSeconds : noSubscription,
    nowToTheSecond,
    nowToTheSecond
  );
  if (!household) return null;

  // Type guard: only admins get joinCode fields
  const hasJoinCode = "joinCode" in household;
  if (!isAdmin || !hasJoinCode) return null;

  // Now TypeScript knows household has joinCode fields
  const adminHousehold = household as HouseholdAdminSettingsDto;
  const msRemaining = adminHousehold.joinCodeExpiresAt
    ? new Date(adminHousehold.joinCodeExpiresAt).getTime() - now
    : -1;
  const joinCodeExpired = msRemaining <= 0;
  const timeRemaining =
    msRemaining <= 0
      ? t("expired")
      : t("countdown", {
          minutes: Math.floor(msRemaining / 60000),
          seconds: Math.floor((msRemaining % 60000) / 1000),
        });
  const handleCopyJoinCode = async () => {
    // Type guard ensures household has joinCode
    if ("joinCode" in household && household.joinCode) {
      try {
        await navigator.clipboard.writeText(household.joinCode);
        toast(t("copySuccess"), {
          variant: "success",
        });
      } catch (error) {
        showSafeErrorToast({
          title: t("copyFailed"),
          description: tErrors("technicalDetails"),
          color: "danger",
          error,
          context: "household-join-code:copy",
        });
      }
    }
  };
  const handleRegenerateCode = () => {
    regenerateJoinCode(household.id);
  };
  return (
    <SettingsCard icon={ClipboardDocumentIconOutline} title={t("title")}>
      {adminHousehold.joinCode && !joinCodeExpired ? (
        <>
          <p className="text-muted text-base">{t("shareDescription")}</p>
          <div className="flex gap-2">
            <Input
              variant="secondary"
              readOnly
              className="font-mono text-lg tracking-wider"
              value={adminHousehold.joinCode || ""}
            />
            <IconActionButton
              action="duplicate"
              icon={ClipboardDocumentIconSolid}
              label={t("copyButton")}
              variant="primary"
              onPress={handleCopyJoinCode}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted text-base">
              {t("expiresIn")} <span className="text-warning font-medium">{timeRemaining}</span>
            </span>
            <Button size="sm" variant="tertiary" onPress={handleRegenerateCode}>
              <ArrowPathIcon className="size-4" />
              {t("regenerateButton")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted text-base">{t("noCodeDescription")}</p>
          <ActionButtonGroup>
            <ActionButton action="create" icon={ArrowPathIcon} onPress={handleRegenerateCode}>
              {t("generateButton")}
            </ActionButton>
          </ActionButtonGroup>
        </>
      )}
    </SettingsCard>
  );
}
