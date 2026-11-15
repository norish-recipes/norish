"use client";

import HouseholdInfoCard from "./household-info-card";
import JoinCodeCard from "./join-code-card";
import MembersCard from "./members-card";

export default function HouseholdView() {
  return (
    <div className="flex w-full flex-col gap-6">
      <HouseholdInfoCard />
      <MembersCard />
      <JoinCodeCard />
    </div>
  );
}
