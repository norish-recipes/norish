import React from "react";
import { NoResultsCard } from "@/components/no-results-card";
import { useText } from "@/lib/i18n/use-text";

/** A Settings read that never answered: the error card with Retry. `name` names the test ids. */
export function FailedLoad({ name, onRetry }: { name: string; onRetry: () => void }) {
  const text = useText();

  return (
    <NoResultsCard
      action={{
        label: text("common.actions.retry"),
        icon: "refresh-outline",
        testID: `${name}-retry`,
        onPress: onRetry,
      }}
      className="bg-surface mt-4"
      icon="alert-circle-outline"
      testID={`${name}-failed`}
      title={text("common.errorPage.title")}
      tone="neutral"
    />
  );
}
