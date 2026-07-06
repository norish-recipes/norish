"use client";

import { useEffect, useRef, useState } from "react";
import { EyeIcon, EyeSlashIcon, InformationCircleIcon } from "@heroicons/react/16/solid";
import { ServerIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Card,
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

import type { CalDavCalendarInfo } from "@norish/shared/contracts";

import { useCalDavSettingsContext } from "../context";
import CalDavConfigEditModal from "./caldav-config-edit-modal";
import CalDavConfigSummary from "./caldav-config-summary";

export default function CalDavConfigCard() {
  const t = useTranslations("settings.caldav.setup");
  const { config, saveConfig, testConnection } = useCalDavSettingsContext();
  const {
    isOpen: isEditModalOpen,
    onOpen: onEditModalOpen,
    onClose: onEditModalClose,
  } = useOverlayState();

  // Initial setup form state (only used when no config exists)
  const [serverUrl, setServerUrl] = useState("");
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<CalDavCalendarInfo[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [breakfastTime, setBreakfastTime] = useState("07:00-08:00");
  const [lunchTime, setLunchTime] = useState("12:00-13:00");
  const [dinnerTime, setDinnerTime] = useState("18:00-19:00");
  const [snackTime, setSnackTime] = useState("15:00-16:00");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Track if we've already auto-tested to avoid duplicate calls
  const hasAutoTestedRef = useRef(false);
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setCalendars([]);
    try {
      const result = await testConnection(serverUrl, username, password);
      setTestResult(result);

      // Store returned calendars for selection
      if (result.success && result.calendars && result.calendars.length > 0) {
        setCalendars(result.calendars);
        // Auto-select first calendar
        if (!calendarUrl) {
          const firstCalendar = result.calendars[0];
          if (firstCalendar) {
            setCalendarUrl(firstCalendar.url);
          }
        }
      }
    } finally {
      setTesting(false);
    }
  };

  // Auto-test connection when all credentials are filled
  useEffect(() => {
    // Skip if already testing or if we've already auto-tested
    if (testing || hasAutoTestedRef.current) return;
    if (serverUrl && username && password) {
      hasAutoTestedRef.current = true;
      // Use a local function to avoid dependency issues
      const runAutoTest = async () => {
        setTesting(true);
        setTestResult(null);
        setCalendars([]);
        try {
          const result = await testConnection(serverUrl, username, password);
          setTestResult(result);

          // Store returned calendars for selection
          if (result.success && result.calendars && result.calendars.length > 0) {
            setCalendars(result.calendars);
            // Auto-select first calendar
            if (!calendarUrl) {
              const firstCalendar = result.calendars[0];
              if (firstCalendar) {
                setCalendarUrl(firstCalendar.url);
              }
            }
          }
        } finally {
          setTesting(false);
        }
      };
      runAutoTest();
    }
    // Reset auto-test flag if credentials change after a test
    if (!serverUrl || !username || !password) {
      hasAutoTestedRef.current = false;
    }
  }, [serverUrl, username, password, testing, testConnection, calendarUrl]);
  const handleInitialSetup = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      await saveConfig({
        serverUrl,
        calendarUrl,
        username,
        password,
        enabled: true,
        breakfastTime,
        lunchTime,
        dinnerTime,
        snackTime,
      });
      setPassword(""); // Clear password after save
    } finally {
      setSaving(false);
    }
  };

  // If config exists, show summary
  if (config) {
    return (
      <>
        <CalDavConfigSummary onEditClick={onEditModalOpen} />
        <CalDavConfigEditModal isOpen={isEditModalOpen} onClose={onEditModalClose} />
      </>
    );
  }

  // If no config, show initial setup form with guidance
  const canSave = serverUrl && username && password && calendarUrl;
  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-3">
          <ServerIcon className="text-accent h-6 w-6" />
          <div>
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            <p className="text-muted mt-1 text-base">{t("description")}</p>
          </div>
        </div>
      </Card.Header>

      <Card.Content className="gap-4">
        {/* Guidance Section */}
        <div className="bg-accent/10 border-accent/20 rounded-lg border p-4">
          <div className="flex gap-3">
            <InformationCircleIcon className="text-accent mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-accent mb-2 text-base font-medium">{t("gettingStarted")}</p>
              <p className="text-muted mb-2 text-xs">{t("providerDescription")}</p>
              <ul className="text-muted ml-4 list-disc space-y-1 text-xs">
                <li>
                  <Link
                    isExternal
                    href="https://docs.nextcloud.com/server/latest/user_manual/en/groupware/calendar.html"
                    size="sm"
                    target="_blank"
                  >
                    Nextcloud Calendar
                  </Link>
                </li>
                <li>
                  <Link isExternal href="https://radicale.org/" size="sm" target="_blank">
                    Radicale
                  </Link>
                </li>
                <li>
                  <Link
                    isExternal
                    href="https://support.apple.com/guide/calendar/set-up-accounts-icl4308d6701/mac"
                    size="sm"
                    target="_blank"
                  >
                    Apple Calendar
                  </Link>
                </li>
                <li>
                  <Link
                    isExternal
                    href="https://support.google.com/calendar/answer/99358"
                    size="sm"
                    target="_blank"
                  >
                    Google Calendar
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Setup Form */}
        <TextField isRequired value={serverUrl} onChange={setServerUrl}>
          <Label>{t("serverUrlLabel")}</Label>
          <Input variant="secondary" placeholder={t("serverUrlPlaceholder")} />
          <Description>{t("serverUrlDescription")}</Description>
        </TextField>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField isRequired value={username} onChange={setUsername}>
            <Label>{t("usernameLabel")}</Label>
            <Input variant="secondary" placeholder={t("usernamePlaceholder")} />
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

        {/* Calendar Selection - always visible, disabled until calendars fetched */}
        <Select
          variant="secondary"
          isDisabled={calendars.length === 0}
          placeholder={
            calendars.length === 0 ? t("calendarPlaceholderDisabled") : t("calendarPlaceholder")
          }
          value={calendarUrl}
          onChange={(selected) => {
            setCalendarUrl(typeof selected === "string" ? selected : null);
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField value={breakfastTime} onChange={setBreakfastTime}>
            <Label>{t("breakfastTime")}</Label>
            <Input variant="secondary" placeholder="07:00-08:00" />
            <Description>{t("timeFormat")}</Description>
          </TextField>
          <TextField value={lunchTime} onChange={setLunchTime}>
            <Label>{t("lunchTime")}</Label>
            <Input variant="secondary" placeholder="12:00-13:00" />
            <Description>{t("timeFormat")}</Description>
          </TextField>
          <TextField value={dinnerTime} onChange={setDinnerTime}>
            <Label>{t("dinnerTime")}</Label>
            <Input variant="secondary" placeholder="18:00-19:00" />
            <Description>{t("timeFormat")}</Description>
          </TextField>
          <TextField value={snackTime} onChange={setSnackTime}>
            <Label>{t("snackTime")}</Label>
            <Input variant="secondary" placeholder="15:00-16:00" />
            <Description>{t("timeFormat")}</Description>
          </TextField>
        </div>

        {testResult && (
          <div
            className={`rounded-lg p-3 text-base ${testResult.success ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
          >
            {testResult.message}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            isDisabled={!canSave}
            onPress={handleTestConnection}
            variant="secondary"
            isPending={testing}
          >
            {t("testConnection")}
          </Button>
          <Button
            isDisabled={!canSave}
            onPress={handleInitialSetup}
            variant="primary"
            isPending={saving}
          >
            {t("saveConfiguration")}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
