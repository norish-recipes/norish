"use client";

import { SwitchRow } from "@/app/(app)/settings/components/setting-row";
import SettingsSwitch from "@/app/(app)/settings/components/settings-switch";
import { Note } from "@/components/shared/note";
import { UserGroupIcon } from "@heroicons/react/16/solid";
import { Description, Input, Label, Separator, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import { RestartRequiredChip } from "../restart-required-chip";
import { UnsavedChangesChip } from "../unsaved-changes-chip";

export interface ClaimMappingValues {
  enabled: boolean;
  scopes: string;
  groupsClaim: string;
  adminGroup: string;
  householdPrefix: string;
}

interface OIDCClaimMappingProps {
  values: ClaimMappingValues;
  onChange: (values: ClaimMappingValues) => void;
  isDirty?: boolean;
}

export function OIDCClaimMapping({ values, onChange, isDirty = false }: OIDCClaimMappingProps) {
  const tClaimMapping = useTranslations("settings.admin.authProviders.oidc.claimMapping");

  const updateField = <K extends keyof ClaimMappingValues>(
    field: K,
    value: ClaimMappingValues[K]
  ) => {
    onChange({ ...values, [field]: value });
  };

  return (
    <>
      <Separator className="my-2" />
      <SwitchRow
        badges={
          <>
            {isDirty && <UnsavedChangesChip />}
            <RestartRequiredChip />
          </>
        }
        description={tClaimMapping("description")}
        title={
          <span className="flex items-center gap-2">
            <UserGroupIcon className="text-muted h-4 w-4 shrink-0" />
            {tClaimMapping("title")}
          </span>
        }
      >
        <SettingsSwitch
          color="success"
          isSelected={values.enabled}
          onValueChange={(enabled) => updateField("enabled", enabled)}
        />
      </SwitchRow>

      {values.enabled && <Note status="warning">{tClaimMapping("securityWarning")}</Note>}

      <TextField
        isDisabled={!values.enabled}
        value={values.scopes}
        onChange={(value) => updateField("scopes", value)}
      >
        <Label>{tClaimMapping("scopes")}</Label>
        <Input variant="secondary" placeholder={tClaimMapping("scopesPlaceholder")} />
        <Description>{tClaimMapping("scopesDescription")}</Description>
      </TextField>
      <TextField
        isDisabled={!values.enabled}
        value={values.groupsClaim}
        onChange={(value) => updateField("groupsClaim", value)}
      >
        <Label>{tClaimMapping("groupsClaim")}</Label>
        <Input variant="secondary" placeholder="groups" />
        <Description>{tClaimMapping("groupsClaimDescription")}</Description>
      </TextField>
      <TextField
        isDisabled={!values.enabled}
        value={values.adminGroup}
        onChange={(value) => updateField("adminGroup", value)}
      >
        <Label>{tClaimMapping("adminGroup")}</Label>
        <Input variant="secondary" placeholder="norish_admin" />
        <Description>{tClaimMapping("adminGroupDescription")}</Description>
      </TextField>
      <TextField
        isDisabled={!values.enabled}
        value={values.householdPrefix}
        onChange={(value) => updateField("householdPrefix", value)}
      >
        <Label>{tClaimMapping("householdPrefix")}</Label>
        <Input variant="secondary" placeholder="norish_household_" />
        <Description>{tClaimMapping("householdPrefixDescription")}</Description>
      </TextField>
    </>
  );
}
