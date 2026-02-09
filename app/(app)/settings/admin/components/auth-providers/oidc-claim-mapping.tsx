"use client";

import { Input, Switch, Divider } from "@heroui/react";
import { UserGroupIcon, ExclamationTriangleIcon } from "@heroicons/react/16/solid";
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
      <Divider className="my-2" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserGroupIcon className="text-default-500 h-4 w-4" />
          <span className="text-default-700 font-medium">{tClaimMapping("title")}</span>
          {isDirty && <UnsavedChangesChip />}
          <RestartRequiredChip />
        </div>
        <Switch
          color="success"
          isSelected={values.enabled}
          onValueChange={(enabled) => updateField("enabled", enabled)}
        />
      </div>
      <p className="text-default-500 text-sm">{tClaimMapping("description")}</p>

      {values.enabled && (
        <div className="bg-warning-50 border-warning-200 text-warning-700 flex items-start gap-2 rounded-lg border p-3">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="text-sm">{tClaimMapping("securityWarning")}</p>
        </div>
      )}

      <Input
        description={tClaimMapping("scopesDescription")}
        isDisabled={!values.enabled}
        label={tClaimMapping("scopes")}
        placeholder={tClaimMapping("scopesPlaceholder")}
        value={values.scopes}
        onValueChange={(v) => updateField("scopes", v)}
      />
      <Input
        description={tClaimMapping("groupsClaimDescription")}
        isDisabled={!values.enabled}
        label={tClaimMapping("groupsClaim")}
        placeholder="groups"
        value={values.groupsClaim}
        onValueChange={(v) => updateField("groupsClaim", v)}
      />
      <Input
        description={tClaimMapping("adminGroupDescription")}
        isDisabled={!values.enabled}
        label={tClaimMapping("adminGroup")}
        placeholder="norish_admin"
        value={values.adminGroup}
        onValueChange={(v) => updateField("adminGroup", v)}
      />
      <Input
        description={tClaimMapping("householdPrefixDescription")}
        isDisabled={!values.enabled}
        label={tClaimMapping("householdPrefix")}
        placeholder="norish_household_"
        value={values.householdPrefix}
        onValueChange={(v) => updateField("householdPrefix", v)}
      />
    </>
  );
}
