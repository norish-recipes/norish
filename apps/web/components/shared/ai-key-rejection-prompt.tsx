"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissionsContext } from "@/context/permissions-context";
import { useAIKeyRejections } from "@/hooks/admin/use-ai-key-rejections";
import { showActionToast } from "@/lib/ui/action-toast";
import { useTranslations } from "next-intl";

/** The rejections this tab last told the admin about, so a closed toast is not repeated. */
const SHOWN_STORAGE_KEY = "norish.ai-key-rejection.shown";

function readShown(): string | null {
  try {
    return window.sessionStorage.getItem(SHOWN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberShown(id: string): void {
  try {
    window.sessionStorage.setItem(SHOWN_STORAGE_KEY, id);
  } catch {}
}

/**
 * Tells an administrator, on any page, that the provider is refusing a
 * configured AI key. The features that use it fall back without a word
 * (ingredient matching flags what it adds and carries on), so this is where a
 * revoked key shows. It stays up until closed, once per tab for each refusal.
 */
export default function AIKeyRejectionPrompt() {
  const { isServerAdmin } = usePermissionsContext();
  const rejections = useAIKeyRejections(isServerAdmin);
  const router = useRouter();
  const t = useTranslations("common.aiKeyRejected");

  useEffect(() => {
    if (!rejections || readShown() === rejections.id) return;

    rememberShown(rejections.id);
    showActionToast(rejections.title, {
      description: rejections.description,
      variant: "danger",
      timeout: 0,
      action: { label: t("openSettings"), onPress: () => router.push("/settings?tab=admin") },
    });
    // The id says everything that would change what the toast says.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejections?.id]);

  return null;
}
