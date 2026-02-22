"use client";

import { useEffect } from "react";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("Error");

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Log the error to an error reporting service
    log.error({ err: error }, "Unhandled error");
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
