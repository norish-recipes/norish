"use client";

import { FormEvent, useState } from "react";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { HomeIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { Button, Input, InputOTP, Label, REGEXP_ONLY_DIGITS, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useHouseholdSettingsContext } from "../context";

export default function NoHouseholdView() {
  const t = useTranslations("settings.household");
  const { createHousehold, joinHousehold } = useHouseholdSettingsContext();
  const [householdName, setHouseholdName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const handleCreateHousehold = async (e: FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    createHousehold(householdName);
    setHouseholdName("");
    setIsCreating(false);
  };
  const handleJoinHousehold = async (e: FormEvent) => {
    e.preventDefault();
    setIsJoining(true);
    joinHousehold(joinCode);
    setJoinCode("");
    setIsJoining(false);
  };
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Create Household */}
        <SettingsCard
          description={t("create.description")}
          icon={HomeIcon}
          title={t("create.title")}
        >
          <form className="flex flex-col gap-4" onSubmit={handleCreateHousehold}>
            <TextField isRequired value={householdName} onChange={setHouseholdName}>
              <Label>{t("create.nameLabel")}</Label>
              <Input variant="secondary" placeholder={t("create.namePlaceholder")} />
            </TextField>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" isPending={isCreating}>
                {t("create.submitButton")}
              </Button>
            </div>
          </form>
        </SettingsCard>

        {/* Join Household */}
        <SettingsCard
          description={t("join.description")}
          icon={UserGroupIcon}
          title={t("join.title")}
        >
          <form className="flex flex-col gap-4" onSubmit={handleJoinHousehold}>
            <div className="flex flex-col gap-2">
              <Label>{t("join.codeLabel")}</Label>
              <InputOTP
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                placeholder={t("join.codePlaceholder")}
                value={joinCode}
                onChange={setJoinCode}
              >
                <InputOTP.Group className="justify-start gap-2">
                  {/* The secondary-input treatment every other field on
                        these cards carries: the soft warm fill, no shadow —
                        the plain field fill is pure white and would vanish
                        against the white card. */}
                  {Array.from({ length: 6 }).map((_, index) => (
                    <InputOTP.Slot
                      key={index}
                      className="border-field-border bg-default text-foreground hover:bg-default data-[active=true]:bg-default data-[filled=true]:bg-default h-12 w-10 flex-none shadow-none"
                      index={index}
                    />
                  ))}
                </InputOTP.Group>
              </InputOTP>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" isPending={isJoining}>
                {t("join.submitButton")}
              </Button>
            </div>
          </form>
        </SettingsCard>
      </div>
    </div>
  );
}
