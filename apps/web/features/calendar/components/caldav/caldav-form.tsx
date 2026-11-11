"use client";

import { useState } from "react";
import SecretInput from "@/components/shared/secret-input";
import {
  Accordion,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import type { UserCaldavConfigWithoutPasswordDto } from "@norish/shared/contracts";

import type { ConnectionTarget } from "./use-connection-test";
import { UntrustedCertificateNote } from "./untrusted-certificate-note";
import { useConnectionTest } from "./use-connection-test";

type MealTimeField = "breakfastTime" | "lunchTime" | "dinnerTime" | "snackTime";

/** The meal times in the order the form shows them. */
const MEAL_TIME_FIELDS: MealTimeField[] = ["breakfastTime", "lunchTime", "dinnerTime", "snackTime"];

/** A new setup's meal times, each also its field's placeholder. */
const MEAL_TIME_DEFAULTS: Record<MealTimeField, string> = {
  breakfastTime: "07:00-08:00",
  lunchTime: "12:00-13:00",
  dinnerTime: "18:00-19:00",
  snackTime: "15:00-16:00",
};

const TIME_RANGE = /^\d{2}:\d{2}-\d{2}:\d{2}$/;

/** The CalDAV form's state, starting from the stored config, or empty for a first setup. */
export function useCaldavForm(config: UserCaldavConfigWithoutPasswordDto | null) {
  const [serverUrl, setServerUrl] = useState(config?.serverUrl ?? "");
  const [username, setUsername] = useState(config?.username ?? "");
  const [password, setPassword] = useState("");
  const [calendarUrl, setCalendarUrl] = useState<string | null>(config?.calendarUrl ?? null);
  const [mealTimes, setMealTimes] = useState(() => {
    const { breakfastTime, lunchTime, dinnerTime, snackTime } = config ?? MEAL_TIME_DEFAULTS;

    return { breakfastTime, lunchTime, dinnerTime, snackTime };
  });
  const connection = useConnectionTest(setCalendarUrl, config?.trustedCertificate ?? null);

  return {
    serverUrl,
    setServerUrl,
    username,
    setUsername,
    password,
    setPassword,
    calendarUrl,
    setCalendarUrl,
    mealTimes,
    setMealTime: (field: MealTimeField, value: string) =>
      setMealTimes((prev) => ({ ...prev, [field]: value })),
    timesValid: MEAL_TIME_FIELDS.every((field) => TIME_RANGE.test(mealTimes[field])),
    connection,
    /** The test target, with the password to test with. */
    target: (testPassword: string): ConnectionTarget => ({
      serverUrl,
      username,
      password: testPassword,
      calendarUrl,
    }),
    /** What a save sends; an empty password keeps the stored one. */
    toSave: (enabled: boolean) => ({
      serverUrl,
      calendarUrl,
      username,
      password,
      enabled,
      ...mealTimes,
      trustedCertificate: connection.trustedCertificate,
    }),
  };
}

export type CaldavForm = ReturnType<typeof useCaldavForm>;

interface CaldavFormFieldsProps {
  form: CaldavForm;
  /** A password is stored, so an empty field keeps it. */
  isConfigured: boolean;
  onRevealPassword?: () => Promise<string | null>;
  onTrust: () => void;
}

/** The setup card's and the edit modal's fields: connection, calendar and meal times. */
export function CaldavFormFields({
  form,
  isConfigured,
  onRevealPassword,
  onTrust,
}: CaldavFormFieldsProps) {
  const t = useTranslations("settings.caldav.setup");
  const tConfig = useTranslations("settings.caldav.config");
  const { calendars, testResult, testing } = form.connection;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="flex flex-col gap-4">
      <TextField isRequired value={form.serverUrl} onChange={form.setServerUrl}>
        <Label>{t("serverUrlLabel")}</Label>
        <Input placeholder={t("serverUrlPlaceholder")} variant="secondary" />
        <Description>{t("serverUrlDescription")}</Description>
      </TextField>

      <TextField isRequired value={form.username} onChange={form.setUsername}>
        <Label>{t("usernameLabel")}</Label>
        <Input placeholder={t("usernamePlaceholder")} variant="secondary" />
      </TextField>

      <SecretInput
        isRequired
        isConfigured={isConfigured}
        label={t("passwordLabel")}
        placeholder={t("passwordPlaceholder")}
        value={form.password}
        onReveal={onRevealPassword}
        onValueChange={form.setPassword}
      />

      {testResult?.untrustedCertificate ? (
        <UntrustedCertificateNote
          certificate={testResult.untrustedCertificate}
          isPending={testing}
          onTrust={onTrust}
        />
      ) : (
        testResult && (
          <Chip color={testResult.success ? "success" : "danger"} size="sm" variant="soft">
            {testResult.message}
          </Chip>
        )
      )}

      <Select
        isDisabled={calendars.length === 0}
        placeholder={
          calendars.length === 0 ? t("calendarPlaceholderDisabled") : t("calendarPlaceholder")
        }
        value={form.calendarUrl}
        variant="secondary"
        onChange={(selected) => {
          form.setCalendarUrl(typeof selected === "string" ? selected : null);
        }}
      >
        <Label>{t("calendarLabel")}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <span className="text-muted px-1 text-xs">
          {calendars.length === 0 ? t("calendarDescriptionDisabled") : t("calendarDescription")}
        </span>
        <Select.Popover>
          <ListBox>
            {calendars.map((cal) => (
              <ListBox.Item key={cal.url} id={cal.url} textValue={cal.displayName}>
                {cal.displayName}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <Accordion>
        <Accordion.Item id="advanced">
          <Accordion.Heading>
            <Accordion.Trigger aria-label={tConfig("advancedSettings")}>
              {tConfig("advancedSettings")}
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="flex flex-col gap-4 pb-4">
              <p className="text-muted text-xs">{tConfig("timezone", { timezone })}</p>

              {MEAL_TIME_FIELDS.map((field) => {
                const invalid = !TIME_RANGE.test(form.mealTimes[field]);

                return (
                  <TextField
                    key={field}
                    isInvalid={invalid}
                    value={form.mealTimes[field]}
                    onChange={(value) => form.setMealTime(field, value)}
                  >
                    <Label>{t(field)}</Label>
                    <Input placeholder={MEAL_TIME_DEFAULTS[field]} variant="secondary" />
                    {invalid ? (
                      <FieldError>{t("timeFormatError")}</FieldError>
                    ) : (
                      <Description>{t("timeFormat")}</Description>
                    )}
                  </TextField>
                );
              })}
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}
