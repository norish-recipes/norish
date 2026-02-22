"use client";

import { HouseholdSettingsProvider, useHouseholdSettingsContext } from "../context";

import NoHouseholdView from "./no-household-view";
import HouseholdView from "./household-view";

import SettingsSkeleton from "@/components/skeleton/settings-skeleton";

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
