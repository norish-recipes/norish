"use client";

import { SubmitEvent, useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { ArrowRightEndOnRectangleIcon } from "@heroicons/react/16/solid";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import { InputOTP, Label, REGEXP_ONLY_DIGITS } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useHouseholdMutations } from "@norish/shared-react/reader";

export default function JoinHouseholdCard() {
  const t = useTranslations("settings.household");
  const { joinHousehold } = useHouseholdMutations();
  const [joinCode, setJoinCode] = useState("");
  const handleJoinHousehold = (e: SubmitEvent) => {
    e.preventDefault();
    void joinHousehold(joinCode).then((went) => went && setJoinCode(""));
  };
  return (
    <SettingsCard description={t("join.description")} icon={UserGroupIcon} title={t("join.title")}>
      <form className="flex flex-1 flex-col gap-4" onSubmit={handleJoinHousehold}>
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
              {/* Secondary-input fill, no shadow: the plain field fill is white
                      and would vanish against the white card. */}
              {Array.from({ length: 6 }).map((_, index) => (
                <InputOTP.Slot
                  // A code slot is its position.
                  // eslint-disable-next-line @eslint-react/no-array-index-key
                  key={index}
                  className="border-field-border bg-default text-foreground hover:bg-default data-[active=true]:bg-default data-[filled=true]:bg-default h-12 w-10 flex-none shadow-none"
                  index={index}
                />
              ))}
            </InputOTP.Group>
          </InputOTP>
        </div>
        <ActionButtonGroup className="mt-auto">
          <ActionButton action="apply" icon={ArrowRightEndOnRectangleIcon} type="submit">
            {t("join.submitButton")}
          </ActionButton>
        </ActionButtonGroup>
      </form>
    </SettingsCard>
  );
}
