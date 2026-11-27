import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { Skeleton } from "heroui-native";

import type { readState } from "../utils/read-state";
import { FailedLoad } from "./failed-load";

/** A Settings page's body by how its read went: `children` once it holds something, else the
 * loading skeleton, a failed load with Retry, or `empty`. `name` names the test ids. */
export function ReadBody({
  state,
  name,
  onRetry,
  empty,
  children,
}: {
  state: ReturnType<typeof readState>;
  name: string;
  onRetry: () => void;
  empty: ReactNode;
  children: ReactNode;
}) {
  if (state === "held") return children;
  if (state === "failed") return <FailedLoad name={name} onRetry={onRetry} />;

  return state === "loading" ? (
    <View className="gap-1.5 pt-4" testID={`${name}-loading`}>
      <Skeleton className="h-[150px] rounded-[22px]" />
    </View>
  ) : (
    empty
  );
}
