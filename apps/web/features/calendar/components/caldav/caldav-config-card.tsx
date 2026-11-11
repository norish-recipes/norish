"use client";

import { useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Note } from "@/components/shared/note";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/16/solid";
import { ServerIcon } from "@heroicons/react/24/outline";
import {
  Description,
  Input,
  InputGroup,
  Label,
  Link,
  ListBox,
  Select,
  TextField,
  useOverlayState,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import { useCaldavConfigQuery, useCaldavMutations } from "@norish/shared-react/calendar";

import CaldavConfigEditModal from "./caldav-config-edit-modal";
import CaldavConfigSummary from "./caldav-config-summary";
import { UntrustedCertificateNote } from "./untrusted-certificate-note";
import { useConnectionTest } from "./use-connection-test";

export default function CaldavConfigCard() {
  const t = useTranslations("settings.caldav.setup");
  const tActions = useTranslations("common.actions");
  const tSecret = useTranslations("common.secret");
  const { config } = useCaldavConfigQuery();
  const { saveConfig, isSavingConfig: saving } = useCaldavMutations();
  const {
    isOpen: isEditModalOpen,
    open: onEditModalOpen,
    close: onEditModalClose,
  } = useOverlayState();

  const [serverUrl, setServerUrl] = useState("");
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const {
    calendars,
    testResult,
    setTestResult,
    testing,
    runTest,
    trustedCertificate,
    trustAndRetest,
  } = useConnectionTest(setCalendarUrl);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [breakfastTime, setBreakfastTime] = useState("07:00-08:00");
  const [lunchTime, setLunchTime] = useState("12:00-13:00");
  const [dinnerTime, setDinnerTime] = useState("18:00-19:00");
  const [snackTime, setSnackTime] = useState("15:00-16:00");

  const handleTestConnection = () => runTest(serverUrl, username, password, calendarUrl);
  const handleInitialSetup = async () => {
    setTestResult(null);
    const saved = await saveConfig({
      serverUrl,
      calendarUrl,
      username,
      password,
      enabled: true,
      breakfastTime,
      lunchTime,
      dinnerTime,
      snackTime,
      trustedCertificate,
    });

    if (saved) setPassword("");
  };

  if (config) {
    return (
      <>
        <CaldavConfigSummary onEditClick={onEditModalOpen} />
        <CaldavConfigEditModal isOpen={isEditModalOpen} onClose={onEditModalClose} />
      </>
    );
  }

  const canSave = serverUrl && username && password && calendarUrl;

  return (
    <SettingsCard description={t("description")} icon={ServerIcon} title={t("title")}>
      <Note status="accent" title={t("gettingStarted")}>
        <p className="mb-2">{t("providerDescription")}</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <Link
              href="https://docs.nextcloud.com/server/latest/user_manual/en/groupware/calendar.html"
              rel="noopener noreferrer"
              target="_blank"
            >
              Nextcloud Calendar
            </Link>
          </li>
          <li>
            <Link href="https://radicale.org/" rel="noopener noreferrer" target="_blank">
              Radicale
            </Link>
          </li>
          <li>
            <Link
              href="https://support.apple.com/guide/calendar/set-up-accounts-icl4308d6701/mac"
              rel="noopener noreferrer"
              target="_blank"
            >
              Apple Calendar
            </Link>
          </li>
          {/* No Google Calendar here: its CalDAV endpoint now requires
                OAuth/OIDC, which this username/password setup cannot do. */}
        </ul>
      </Note>

      <TextField isRequired value={serverUrl} onChange={setServerUrl}>
        <Label>{t("serverUrlLabel")}</Label>
        <Input placeholder={t("serverUrlPlaceholder")} variant="secondary" />
        <Description>{t("serverUrlDescription")}</Description>
      </TextField>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField isRequired value={username} onChange={setUsername}>
          <Label>{t("usernameLabel")}</Label>
          <Input placeholder={t("usernamePlaceholder")} variant="secondary" />
        </TextField>
        <TextField
          isRequired
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={setPassword}
        >
          <Label>{t("passwordLabel")}</Label>
          <InputGroup variant="secondary">
            <InputGroup.Input placeholder={t("passwordPlaceholder")} />
            <InputGroup.Suffix>
              <button
                aria-label={showPassword ? tSecret("hide") : tSecret("reveal")}
                className="focus:outline-none"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeSlashIcon className="text-muted h-4 w-4" />
                ) : (
                  <EyeIcon className="text-muted h-4 w-4" />
                )}
              </button>
            </InputGroup.Suffix>
          </InputGroup>
        </TextField>
      </div>

      <Select
        isDisabled={calendars.length === 0}
        placeholder={
          calendars.length === 0 ? t("calendarPlaceholderDisabled") : t("calendarPlaceholder")
        }
        value={calendarUrl}
        variant="secondary"
        onChange={(selected) => {
          setCalendarUrl(typeof selected === "string" ? selected : null);
        }}
      >
        <Label>{t("calendarLabel")}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Description>
          {calendars.length === 0 ? t("calendarDescriptionDisabled") : t("calendarDescription")}
        </Description>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField value={breakfastTime} onChange={setBreakfastTime}>
          <Label>{t("breakfastTime")}</Label>
          <Input placeholder="07:00-08:00" variant="secondary" />
          <Description>{t("timeFormat")}</Description>
        </TextField>
        <TextField value={lunchTime} onChange={setLunchTime}>
          <Label>{t("lunchTime")}</Label>
          <Input placeholder="12:00-13:00" variant="secondary" />
          <Description>{t("timeFormat")}</Description>
        </TextField>
        <TextField value={dinnerTime} onChange={setDinnerTime}>
          <Label>{t("dinnerTime")}</Label>
          <Input placeholder="18:00-19:00" variant="secondary" />
          <Description>{t("timeFormat")}</Description>
        </TextField>
        <TextField value={snackTime} onChange={setSnackTime}>
          <Label>{t("snackTime")}</Label>
          <Input placeholder="15:00-16:00" variant="secondary" />
          <Description>{t("timeFormat")}</Description>
        </TextField>
      </div>

      {testResult?.untrustedCertificate ? (
        <UntrustedCertificateNote
          certificate={testResult.untrustedCertificate}
          isPending={testing}
          onTrust={() => trustAndRetest(serverUrl, username, password, calendarUrl)}
        />
      ) : (
        testResult && (
          <div
            className={`rounded-lg p-3 text-base ${testResult.success ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
          >
            {testResult.message}
          </div>
        )
      )}

      <ActionButtonGroup>
        <ActionButton
          action="test"
          isDisabled={!serverUrl || !username || !password}
          isPending={testing}
          onPress={handleTestConnection}
        >
          {tActions("test")}
        </ActionButton>
        <ActionButton
          action="save"
          isDisabled={!canSave}
          isPending={saving}
          onPress={handleInitialSetup}
        >
          {tActions("save")}
        </ActionButton>
      </ActionButtonGroup>
    </SettingsCard>
  );
}
