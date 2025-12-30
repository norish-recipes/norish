"use client";

import { Card, CardBody, CardHeader, Switch } from "@heroui/react";
import { UserPlusIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useAdminSettingsContext } from "../context";

export default function RegistrationCard() {
  const t = useTranslations("settings.admin.registration");
  const { registrationEnabled, updateRegistration, isLoading } = useAdminSettingsContext();

  const handleToggle = async (checked: boolean) => {
    await updateRegistration(checked);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UserPlusIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </CardHeader>
      <CardBody>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{t("allowRegistration")}</span>
            <span className="text-default-500 text-base">
              {t("description")}
            </span>
          </div>
          <Switch
            color="success"
            isDisabled={isLoading}
            isSelected={registrationEnabled ?? false}
            onValueChange={handleToggle}
          />
        </div>
      </CardBody>
    </Card>
  );
}
