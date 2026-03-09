"use client";

import { createHouseholdHooks } from "@norish/shared-react/hooks";
import { addToast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useUser } from "@norish/shared-react/hooks";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { useUserContext } from "@/context/user-context";

export const sharedHouseholdHooks = createHouseholdHooks({
  useTRPC,
  useCurrentUserId: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { user } = useUser();
    return user?.id;
  },
  useCurrentUserName: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { user } = useUserContext();
    return user?.name ?? null;
  },
  useToastAdapter: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
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
