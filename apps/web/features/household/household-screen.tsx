"use client";

import { useHousehold } from "@norish/shared-react/reader";

import type { HouseholdShape } from "./household-shape";
import HouseholdSkeleton from "./components/household-skeleton";
import HouseholdView from "./components/household-view";
import NoHouseholdView from "./components/no-household-view";

export function HouseholdScreen({ shape }: { shape: HouseholdShape }) {
  const { household, isLoading } = useHousehold();

  if (isLoading) {
    return <HouseholdSkeleton shape={shape} />;
  }

  return household ? <HouseholdView /> : <NoHouseholdView />;
}
