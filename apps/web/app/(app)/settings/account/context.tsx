"use client";

import { useUserMutations } from "@/hooks/user/use-user-mutations";
import { useUserSettingsQuery } from "@/hooks/user/use-user-query";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { useTranslations } from "next-intl";

import { createUserSettingsContext } from "@norish/shared-react/contexts";
import { usePlatform } from "@norish/shared-react/platform";
import { addBasePath } from "@norish/shared/lib/base-path";

export type { UserSettingsContextValue } from "@norish/shared-react/contexts";

// The context calls this as a hook, so other platforms can use hooks in theirs; the web's needs none.
function deleteAccountAdapter() {
  return {
    onSuccess: () => {
      window.location.href = addBasePath("/login");
    },
  };
}

const { UserSettingsProvider, useUserSettingsContext } = createUserSettingsContext({
  useUserSettingsQuery,
  useUserMutations,
  useErrorHandler: () => {
    const tErrors = useTranslations("common.errors");
    const { showError } = usePlatform();

    return {
      showError,
      showValidationError: (_message: string, context: string) => {
        showSafeErrorToast({
          title: tErrors("nameCannotBeEmpty"),
          description: "",
          context,
          color: "danger",
        });
      },
    };
  },
  useDeleteAccountAdapter: deleteAccountAdapter,
});

export { UserSettingsProvider, useUserSettingsContext };
