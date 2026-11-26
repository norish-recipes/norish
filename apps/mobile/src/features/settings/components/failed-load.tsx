import React from "react";
import { EmptyCard } from "@/components/empty-card";
import { useText } from "@/lib/i18n/use-text";

/** A Settings read that never answered: the error card with Retry. `name` names the test ids. */
export function FailedLoad({ name, onRetry }: { name: string; onRetry: () => void }) {
  const text = useText();

  return (
    <EmptyCard
      action={{
        label: text("common.actions.retry"),
        icon: "refresh-outline",
        testID: `${name}-retry`,
        onPress: onRetry,
      }}
      icon="alert-circle-outline"
      placement="section"
      testID={`${name}-failed`}
      title={text("common.errorPage.title")}
    />
  );
}
