"use client";

import HouseholdInfoCard from "./household-info-card";
import MembersCard from "./members-card";
import JoinCodeCard from "./join-code-card";

export default function HouseholdView() {
  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold">Household Settings</h1>
      <HouseholdInfoCard />
      <MembersCard />
      <JoinCodeCard />
    </div>
  );
}
