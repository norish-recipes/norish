"use client";

import { useRouter } from "next/navigation";
import { HomeIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import { NoraCard } from "./nora-card";

type Props = {
  title?: string;
  message?: string;
  /** Fill the viewport (the root 404) instead of the content area. */
  fullViewport?: boolean;
};

export function NotFoundView({ title, message, fullViewport = false }: Props) {
  const router = useRouter();
  const t = useTranslations("common.notFound");
  const tActions = useTranslations("common.actions");

  return (
    <div
      className={
        fullViewport
          ? "bg-background flex items-center justify-center p-4"
          : "flex min-h-[60vh] items-center justify-center p-6"
      }
      style={fullViewport ? { minHeight: "calc(100vh - env(safe-area-inset-top))" } : undefined}
    >
      <NoraCard code={t("code")} message={message ?? t("message")} title={title ?? t("title")}>
        <Button className="mt-4 rounded-lg px-6" variant="primary" onPress={() => router.push("/")}>
          <HomeIcon className="h-4 w-4" />
          {tActions("goHome")}
        </Button>
      </NoraCard>
    </div>
  );
}
