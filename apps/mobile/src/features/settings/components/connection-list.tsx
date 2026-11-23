import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { NoResultsCard } from "@/components/no-results-card";
import { Skeleton } from "heroui-native";

import type { ReadStatus } from "@norish/shared-react/reader";

import { readState } from "../utils/read-state";
import { FailedLoad } from "./failed-load";

/** The body of a connections page: its rows, or the loading skeleton, a failed load with Retry, or
 * the empty card, by how `read` went and how many rows it holds. */
export function ConnectionList({
  read,
  count,
  name,
  emptyTitle,
  emptyIcon,
  children,
}: {
  read: ReadStatus;
  count: number;
  /** Names the test ids. */
  name: string;
  emptyTitle: string;
  emptyIcon: React.ComponentProps<typeof NoResultsCard>["icon"];
  children: ReactNode;
}) {
  const { answered, isLoading, error } = read;
  const state = readState({ held: count > 0, answered, isLoading, error });

  if (state === "held") return children;
  if (state === "failed") return <FailedLoad name={name} onRetry={read.refetch} />;

  return state === "loading" ? (
    <View className="gap-1.5 pt-4" testID={`${name}-loading`}>
      <Skeleton className="h-[150px] rounded-[22px]" />
    </View>
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
