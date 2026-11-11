"use client";

import type { HouseholdShape } from "./household-shape";
import { HouseholdSettingsProvider, useHouseholdSettingsContext } from "../context";
import HouseholdSkeleton from "./household-skeleton";
import HouseholdView from "./household-view";
import NoHouseholdView from "./no-household-view";

function HouseholdSettingsContent({ shape }: { shape: HouseholdShape }) {
  const { household, isLoading } = useHouseholdSettingsContext();

  if (isLoading) {
    return <HouseholdSkeleton shape={shape} />;
  }

  return household ? <HouseholdView /> : <NoHouseholdView />;
}

export default function HouseholdSettingsContentWrapper({ shape }: { shape: HouseholdShape }) {
  return (
    <HouseholdSettingsProvider>
      <HouseholdSettingsContent shape={shape} />
    </HouseholdSettingsProvider>
  );
}
