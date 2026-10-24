"use client";

import { useEffect } from "react";
import { NoraCard } from "@/components/shared/nora-card";
import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("Error");

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("common.errorPage");

  useEffect(() => {
    // Spelled out rather than handed over whole: the dev server forwards this
    // console line to a terminal by stringifying it, and an Error stringifies
    // to "[object Error]" — which is how a crash reaches a maintainer saying
    // nothing at all.
    log.error(
      {
        err: error.message,
        name: error.name,
        digest: error.digest,
        stack: error.stack,
      },
      "Unhandled error"
    );
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <NoraCard message={t("message")} title={t("title")}>
        {/* Fetches the segment again and re-renders it. */}
        <Button className="mt-4 rounded-lg px-6" variant="primary" onPress={() => retry()}>
          <ArrowPathIcon className="h-4 w-4" />
          {t("retry")}
        </Button>
      </NoraCard>
    </div>
  );
}
