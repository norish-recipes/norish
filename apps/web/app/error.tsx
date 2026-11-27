"use client";

import { useEffect } from "react";
import { ErrorView } from "@/components/shared/error-view";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("Error");

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
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

  // Fetches the segment again and re-renders it.
  return <ErrorView onRetry={() => retry()} />;
}
