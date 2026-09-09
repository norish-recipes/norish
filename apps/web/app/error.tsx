"use client";

import { useEffect } from "react";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("Error");

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Spelled out rather than handed over whole: the dev server forwards this
    // console line to a terminal by stringifying it, and an Error stringifies
    // to "[object Error]" — which is how a crash reaches a maintainer saying
    // nothing at all.
    log.error(
      {
        err: error.message,
        name: error.name,
        digest: (error as Error & { digest?: string }).digest,
        stack: error.stack,
      },
      "Unhandled error"
    );
  }, [error]);

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Try again
      </button>
    </div>
  );
}
