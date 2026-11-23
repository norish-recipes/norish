import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { NoResultsCard } from "@/components/no-results-card";
import { useText } from "@/lib/i18n/use-text";
import { Skeleton } from "heroui-native";

import type { listState } from "../utils/list-state";

/** The body of a connections page: its rows, or the loading skeleton, a failed load with Retry, or
 * the empty card, by `state`. */
export function ConnectionList({
  state,
  name,
  emptyTitle,
  emptyIcon,
  onRetry,
  children,
}: {
  state: ReturnType<typeof listState>;
  /** Names the test ids. */
  name: string;
  emptyTitle: string;
  emptyIcon: React.ComponentProps<typeof NoResultsCard>["icon"];
  onRetry: () => void;
  children: ReactNode;
}) {
  const text = useText();

  if (state === "list") return children;

  if (state === "loading") {
    return (
      <View className="gap-1.5 pt-4" testID={`${name}-loading`}>
        <Skeleton className="h-[150px] rounded-[22px]" />
      </View>
    );
  }

  return state === "failed" ? (
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
  ) : (
    <NoResultsCard
      className="bg-surface mt-4"
      icon={emptyIcon}
      testID={`${name}-empty`}
      title={emptyTitle}
      tone="neutral"
    />
  );
}
