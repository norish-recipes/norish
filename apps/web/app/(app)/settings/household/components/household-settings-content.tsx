"use client";

import SettingsSkeleton from "@/components/skeleton/settings-skeleton";

import { HouseholdSettingsProvider, useHouseholdSettingsContext } from "../context";
import HouseholdView from "./household-view";
import NoHouseholdView from "./no-household-view";

function HouseholdSettingsContent() {
  const { household, isLoading } = useHouseholdSettingsContext();

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return household ? <HouseholdView /> : <NoHouseholdView />;
}

export default function HouseholdSettingsContentWrapper() {
  return (
    <HouseholdSettingsProvider>
      <HouseholdSettingsContent />
    </HouseholdSettingsProvider>
  );
}
