"use client";

import { FormEvent, useState } from "react";
import { HomeIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { Button, Card, Input, InputOTP, Label, REGEXP_ONLY_DIGITS, TextField } from "@heroui/react";
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
      <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Create Household */}
        <Card>
          <Card.Header>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <HomeIcon className="h-5 w-5" />
              {t("create.title")}
            </h2>
          </Card.Header>
          <Card.Content>
            <form className="flex flex-col gap-4" onSubmit={handleCreateHousehold}>
              <p className="text-muted text-base">{t("create.description")}</p>
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
          </Card.Content>
        </Card>

        {/* Join Household */}
        <Card>
          <Card.Header>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <UserGroupIcon className="h-5 w-5" />
              {t("join.title")}
            </h2>
          </Card.Header>
          <Card.Content>
            <form className="flex flex-col gap-4" onSubmit={handleJoinHousehold}>
              <p className="text-muted text-base">{t("join.description")}</p>
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
                    {Array.from({ length: 6 }).map((_, index) => (
                      <InputOTP.Slot
                        key={index}
                        className="border-field-border bg-field text-foreground shadow-field data-[active=true]:bg-field-focus data-[filled=true]:bg-field-focus h-12 w-10 flex-none"
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
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
