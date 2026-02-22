"use client";

import { useTranslations } from "next-intl";

import HouseholdInfoCard from "./household-info-card";
import MembersCard from "./members-card";
import JoinCodeCard from "./join-code-card";

export default function HouseholdView() {
  const t = useTranslations("settings.household");

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
      <HouseholdInfoCard />
      <MembersCard />
      <JoinCodeCard />
    </div>
  );
}
