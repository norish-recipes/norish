"use client";

import { addToast } from "@heroui/react";
import { useTranslations } from "next-intl";
import { createHouseholdHooks, useUser } from "@norish/shared-react/hooks";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useUserContext } from "@/context/user-context";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";

export const sharedHouseholdHooks = createHouseholdHooks({
  useTRPC,
  useCurrentUserId: () => {
     
    const { user } = useUser();

    return user?.id;
  },
  useCurrentUserName: () => {
     
    const { user } = useUserContext();

    return user?.name ?? null;
  },
  useToastAdapter: () => {
     
    const tErrors = useTranslations("common.errors");

    return {
      showKickedToast: () => {
        addToast({
          title: "Removed from household",
          description: "You have been removed from the household by an admin.",
          color: "warning",
          shouldShowTimeoutProgress: true,
          radius: "full",
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
  },
});
