"use client";

import { useHousehold } from "@norish/shared-react/reader";

import HouseholdInfoCard from "./household-info-card";
import JoinCodeCard from "./join-code-card";
import JoinHouseholdCard from "./join-household-card";
import MembersCard from "./members-card";

export default function HouseholdView() {
  const { household } = useHousehold();
  // A household of one: just you, its join code, and a code to join another.
  const solo = household?.users.length === 1;

  return (
    <div className="flex w-full flex-col gap-6">
      <HouseholdInfoCard />
      {!solo && <MembersCard />}
      <JoinCodeCard />
      {solo && <JoinHouseholdCard />}
    </div>
  );
}
