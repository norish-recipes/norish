"use client";

import { useHousehold } from "@norish/shared-react/reader";

import type { HouseholdShape } from "./household-shape";
import HouseholdSkeleton from "./components/household-skeleton";
import HouseholdView from "./components/household-view";

export function HouseholdScreen({ shape }: { shape: HouseholdShape }) {
  const { household, isLoading } = useHousehold();

  if (isLoading || !household) {
    return <HouseholdSkeleton shape={shape} />;
  }

  return <HouseholdView />;
}
