"use client";

import { useUserContext } from "@/context/user-context";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useUser } from "@norish/shared-react/hooks/use-user";

export function useCurrentHouseholdUserId() {
  const { user } = useUser();

  return user?.id;
}

export function useCurrentHouseholdUserName() {
  const { user } = useUserContext();

  return user?.name ?? null;
}

export function useHouseholdToastAdapter() {
  const tErrors = useTranslations("common.errors");

  return {
    showKickedToast: () => {
      toast("Removed from household", {
        description: "You have been removed from the household by an admin.",
        variant: "warning",
      });
    },
    showErrorToast: (reason: string) => {
      showSafeErrorToast({
        title: tErrors("operationFailed"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error: reason,
        context: "household-subscription:onFailed",
      });
    },
  };
}
